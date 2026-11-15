import json
import re
import traceback
from collections.abc import AsyncGenerator
from datetime import datetime
from typing import Any

from fastapi import FastAPI
from fastapi.responses import Response, StreamingResponse
from fastapi.routing import APIRoute
from fastapi.security import HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.types import ASGIApp, Receive, Scope, Send

from core.dependency import AuthControl
from log.context import LogContext
from core.db import db_session
from models.admin import AuditLog, User

from .bgtask import BgTasks


def _match_route(
    routes: Any,
    path: str,
    method: str,
    prefix: str = "",
    tags: tuple[str, ...] = (),
) -> tuple[APIRoute, tuple[str, ...]] | None:
    """在路由树中递归查找匹配的 APIRoute，返回 (route, 累积 tags)。

    为什么要递归 + 累积前缀和 tags：FastAPI 0.12x+ 的 include_router 会把子路由
    包进 _IncludedRouter，其 original_router.routes 里的 APIRoute 只有**相对路径**
    （'' 或 '/{id}'）、tags 也往往是空的，真实 prefix/tags 记在
    include_context.prefix / include_context.tags 上。直接用顶层 route.path_regex
    匹配完整 URL、直接读 route.tags，都会得到空值 —— 这正是审计日志 module
    一直是空、「按模块筛选」全部失效的根因。
    """
    for route in routes or []:
        if isinstance(route, APIRoute):
            full = prefix + route.path
            if not re.fullmatch(_path_to_regex(full), path):
                continue
            if method not in (route.methods or ()):
                continue
            merged = tags + tuple(str(t) for t in (route.tags or ()))
            return route, merged
        ctx = getattr(route, "include_context", None)
        sub_prefix = prefix + (getattr(ctx, "prefix", "") or "")
        sub_tags = tags + tuple(str(t) for t in (getattr(ctx, "tags", None) or ()))
        candidates = [
            getattr(route, "routes", None),
            getattr(getattr(route, "original_router", None), "routes", None),
            getattr(getattr(route, "app", None), "routes", None),
        ]
        for candidate in candidates:
            if not candidate:
                continue
            found = _match_route(candidate, path, method, sub_prefix, sub_tags)
            if found is not None:
                return found
    return None


def _path_to_regex(template: str) -> str:
    """把 '/a/{id}/b' 转成可匹配实际路径的正则（参数段匹配非斜杠串）。"""
    pattern = re.sub(r"\{[^/}]+\}", "[^/]+", template)
    return pattern.rstrip("/") or "/"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """安全头中间件"""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)

        # 添加安全头
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # 为Swagger UI和ReDoc设置更宽松的CSP策略
        if request.url.path in ["/docs", "/redoc"]:
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com; "
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; "
                "img-src 'self' data: https: blob:; "
                "font-src 'self' data: https://cdn.jsdelivr.net https://unpkg.com; "
                "connect-src 'self'; "
                "worker-src 'self' blob:; "
                "child-src 'self' blob:"
            )
        else:
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "font-src 'self' data:; "
                "connect-src 'self'"
            )

        # 仅在HTTPS环境下添加HSTS头
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )

        return response


class SimpleBaseMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive=receive)

        response = await self.before_request(request) or self.app
        await response(request.scope, request.receive, send)
        await self.after_request(request)

    async def before_request(self, request: Request):
        return self.app

    async def after_request(self, request: Request):
        return None


class BackGroundTaskMiddleware(SimpleBaseMiddleware):
    async def before_request(self, request):
        await BgTasks.init_bg_tasks_obj()

    async def after_request(self, request):
        await BgTasks.execute_tasks()


def _extract_bearer_credentials(
    request: Request,
) -> HTTPAuthorizationCredentials | None:
    """从 Authorization: Bearer 头提取凭证（兼容旧的裸 token 头）。

    基座修改原因（BE-08）：模板原实现读 request.headers["token"] 裸字符串，
    与 AuthControl.is_authed 的 HTTPBearer 参数签名不匹配（str 无 .credentials），
    导致管理后台（统一发 Authorization: Bearer <jwt>）的审计日志操作人恒为 0/空。
    这里构造 HTTPAuthorizationCredentials 对齐签名，使操作日志可归属到人。
    """
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        token = auth_header[len("bearer ") :].strip()
    else:
        token = (request.headers.get("token") or "").strip()
    if not token:
        return None
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


class HttpAuditLogMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, methods: list[str], exclude_paths: list[str]):
        super().__init__(app)
        self.methods = methods
        self.exclude_paths = exclude_paths
        self.audit_log_paths = ["/api/v1/auditlog/list"]
        self.max_body_size = 1024 * 1024  # 1MB 响应体大小限制

    async def get_request_args(self, request: Request) -> dict:
        args = {}
        # 获取查询参数
        for key, value in request.query_params.items():
            args[key] = value

        # 获取请求体
        if request.method in ["POST", "PUT", "PATCH"]:
            content_type = request.headers.get("content-type", "")

            # 如果是文件上传请求，跳过请求体解析
            if "multipart/form-data" in content_type:
                return args

            try:
                body = await request.json()
                args.update(body)
            except json.JSONDecodeError:
                try:
                    body = await request.form()
                    args.update(body)
                except Exception:
                    pass

        return args

    async def get_response_body(self, request: Request, response: Response) -> Any:
        # 对于流式响应，不记录响应体
        if isinstance(response, StreamingResponse):
            return {"message": "[Streaming Response]"}

        # 检查响应类型，如果是流式相关的响应类型也跳过
        if hasattr(response, "body_iterator") and not hasattr(response, "body"):
            return {"message": "[Streaming Response]"}

        body = b""
        # 检查Content-Length
        content_length = response.headers.get("content-length")
        if content_length and int(content_length) > self.max_body_size:
            return {
                "code": 0,
                "msg": "Response too large to log",
                "data": None,
            }

        try:
            if hasattr(response, "body"):
                body = response.body
            else:
                body_chunks = []
                async for chunk in response.body_iterator:
                    if not isinstance(chunk, bytes):
                        chunk = chunk.encode(response.charset)
                    body_chunks.append(chunk)

                response.body_iterator = self._async_iter(body_chunks)
                body = b"".join(body_chunks)
        except Exception:
            # 如果读取响应体失败，返回默认值
            return {"message": "[Unable to read response body]"}

        if any(request.url.path.startswith(path) for path in self.audit_log_paths):
            try:
                data = self.lenient_json(body)
                # 只保留基本信息，去除详细的响应内容
                if isinstance(data, dict):
                    data.pop("response_body", None)
                    if "data" in data and isinstance(data["data"], list):
                        for item in data["data"]:
                            item.pop("response_body", None)
                return data
            except Exception:
                return None

        return self.lenient_json(body)

    def lenient_json(self, v: Any) -> Any:
        if isinstance(v, str | bytes):
            try:
                return json.loads(v)
            except (ValueError, TypeError):
                pass
        return v

    async def _async_iter(self, items: list[bytes]) -> AsyncGenerator[bytes, None]:
        for item in items:
            yield item

    async def get_request_log(self, request: Request, response: Response) -> dict:
        """
        根据request和response对象获取对应的日志记录数据
        """
        data: dict = {
            "path": request.url.path,
            "status": response.status_code,
            "method": request.method,
        }
        # 路由信息（module=tags / summary）
        # 必须递归：FastAPI 0.12x 起 include_router 会把子路由包进 _IncludedRouter，
        # 顶层 app.routes 只看到包装器，直接遍历会拿不到 tags → 审计日志 module 空，
        # 「按模块筛选」全部失效。
        matched = _match_route(request.app.routes, request.url.path, request.method)
        if matched is not None:
            route, merged_tags = matched
            data["module"] = ",".join(merged_tags)
            data["summary"] = route.summary
        # 获取用户信息
        try:
            user_obj = None
            credentials = _extract_bearer_credentials(request)
            if credentials is not None:
                user_obj: User = await AuthControl.is_authed(credentials)
            data["user_id"] = user_obj.id if user_obj else 0
            data["username"] = user_obj.username if user_obj else ""
        except Exception:
            data["user_id"] = 0
            data["username"] = ""
        return data

    async def before_request(self, request: Request):
        request_args = await self.get_request_args(request)
        request.state.request_args = request_args

    async def after_request(
        self, request: Request, response: Response, process_time: int
    ):
        if request.method in self.methods:
            for path in self.exclude_paths:
                if re.search(path, request.url.path, re.I) is not None:
                    return
            data: dict = await self.get_request_log(request=request, response=response)
            data["response_time"] = process_time

            data["request_args"] = request.state.request_args
            data["response_body"] = await self.get_response_body(request, response)
            async with db_session() as session:
                session.add(AuditLog(**data))

        return response

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        start_time: datetime = datetime.now()
        await self.before_request(request)
        response = await call_next(request)
        end_time: datetime = datetime.now()
        process_time = int((end_time.timestamp() - start_time.timestamp()) * 1000)
        await self.after_request(request, response, process_time)
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """请求日志中间件"""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """处理请求并记录日志"""
        start_time = datetime.now()

        # 透传上游 trace_id：优先 X-Request-ID 头；缺失则生成
        incoming_id = request.headers.get("x-request-id") or request.headers.get(
            "X-Request-ID"
        )
        request_id = LogContext.set_request_id(incoming_id)
        request.state.trace_id = request_id
        LogContext.update_context(
            method=request.method,
            path=request.url.path,
            url=str(request.url),
            query_params=dict(request.query_params),
            client_ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            content_type=request.headers.get("content-type"),
            content_length=request.headers.get("content-length"),
            start_time=start_time.isoformat(),
        )

        # 获取带上下文的logger
        context_logger = LogContext.get_logger()

        # 记录请求开始
        context_logger.info(f"请求开始: {request.method} {request.url.path}")

        try:
            response = await call_next(request)

            # 计算处理时间
            end_time = datetime.now()
            process_time = (end_time - start_time).total_seconds() * 1000

            # 回写 trace_id 到响应头，便于客户端 / 上游追溯
            response.headers["X-Request-ID"] = request_id

            # 更新上下文信息
            LogContext.update_context(
                status_code=response.status_code,
                process_time_ms=process_time,
                end_time=end_time.isoformat(),
                response_headers=dict(response.headers),
            )

            # 记录请求完成
            context_logger.info(
                f"请求完成: {request.method} {request.url.path} - {response.status_code} ({process_time:.2f}ms)"
            )

            return response

        except Exception as e:
            # 计算处理时间
            end_time = datetime.now()
            process_time = (end_time - start_time).total_seconds() * 1000

            # 更新上下文信息
            LogContext.update_context(
                exception_occurred=True,
                exception_type=type(e).__name__,
                exception_msg=str(e),
                process_time_ms=process_time,
                end_time=end_time.isoformat(),
                traceback=traceback.format_exc(),
            )

            # 记录详细的请求异常信息
            context_logger.error(
                f"请求处理异常: {request.method} {request.url.path} - {type(e).__name__}: {str(e)} ({process_time:.2f}ms)"
            )

            raise
        finally:
            # 清理请求上下文
            LogContext.clear()
