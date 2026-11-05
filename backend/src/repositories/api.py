from fastapi.routing import APIRoute
from sqlalchemy import delete, select

from core.crud import CRUDBase
from core.db import db_session
from log import logger
from models.admin import Api
from schemas.apis import ApiCreate, ApiUpdate
from utils.cache import clear_user_perms_cache_all


class ApiRepository(CRUDBase[Api, ApiCreate, ApiUpdate]):
    def __init__(self):
        super().__init__(model=Api)

    async def refresh_api(self) -> dict:
        """同步路由表 → Api 表。返回 {created, updated, deleted} 计数，
        供调用方判断是否真发生变更（init 期判断升级路径用得到）。"""
        from src import app

        routes = app.routes

        # 路由表里带鉴权的 API 集合
        route_apis: list[tuple[str, str]] = []
        for route in routes:
            if isinstance(route, APIRoute) and len(route.dependencies) > 0:
                route_apis.append((list(route.methods)[0], route.path_format))

        created_count = 0
        updated_count = 0
        deleted = 0

        async with db_session() as session:
            # 现有 Api 表里已不在路由表中的 → 删除
            existing = (await session.scalars(select(Api))).all()
            for api in existing:
                if (api.method, api.path) not in route_apis:
                    logger.debug(f"API Deleted {api.method} {api.path}")
                    await session.execute(
                        delete(Api).where(Api.id == api.id)
                    )
                    deleted += 1

            # 路由表里不在 Api 表中的 → 创建；已存在且内容变化 → 更新
            for method, path in route_apis:
                summary = None
                tags = ""
                for route in routes:
                    if (
                        isinstance(route, APIRoute)
                        and route.methods
                        and list(route.methods)[0] == method
                        and route.path_format == path
                    ):
                        summary = route.summary
                        tags = list(route.tags)[0] if route.tags else ""
                        break

                api_obj = await session.scalar(
                    select(Api).where(Api.method == method, Api.path == path)
                )
                if api_obj is None:
                    logger.debug(f"API Created {method} {path}")
                    session.add(
                        Api(
                            method=method,
                            path=path,
                            summary=summary,
                            tags=tags,
                        )
                    )
                    created_count += 1
                else:
                    api_obj.summary = summary
                    api_obj.tags = tags
                    updated_count += 1

        # API 表变更影响所有用户的权限决策，全量失效权限缓存
        if created_count or updated_count or deleted:
            await clear_user_perms_cache_all()

        return {
            "created": created_count,
            "updated": updated_count,
            "deleted": deleted,
        }


api_repository = ApiRepository()
