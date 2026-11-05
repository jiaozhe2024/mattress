"""wxapi 方案路由（BE-06，V2.0 核心）：CRUD + 快照 + 分享。

挂载：/api/v1/wxapi/schemes*（wxapi/__init__.py 统一挂 prefix/tags）。
鉴权：除 GET /{id}/public（匿名分享回显）外全部走 DependWxAuth（BE-04）。
失败分支：域异常统一经 _translate_errors 转 404/403；
title/product_ids 入参校验由 Pydantic 422 兜底。
"""

from collections.abc import Awaitable, Callable
from typing import TypeVar

from fastapi import APIRouter, HTTPException, Query

from core.wx_dependency import DependWxAuth
from models.wx_user import WxUser
from repositories.wx_scheme import MAX_PAGE_SIZE
from schemas.base import Success
from schemas.wx_scheme import SchemeCreateIn, SchemeUpdateIn
from services import wx_scheme_service
from services.wx_scheme_service import (
    SchemeNotFoundError,
    SchemePermissionError,
    SnapshotProductNotFoundError,
)

router = APIRouter()

T = TypeVar("T")


async def _translate_errors(action: Callable[[], Awaitable[T]]) -> T:
    """执行 service 调用并把方案域异常翻译成 HTTP 语义。"""
    try:
        return await action()
    except SchemeNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except SchemePermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except SnapshotProductNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("", summary="创建方案（固化产品 JSON 快照，产品缺失 404）")
async def create_scheme(body: SchemeCreateIn, user: WxUser = DependWxAuth):
    data = await _translate_errors(
        lambda: wx_scheme_service.create_scheme(user_id=user.id, payload=body)
    )
    return Success(data=data.model_dump(mode="json"))


@router.get("", summary="我的方案列表（create_time desc 分页，软删除不出现）")
async def list_schemes(
    user: WxUser = DependWxAuth,
    page: int = Query(1, ge=1, description="页码，从 1 开始"),
    size: int = Query(20, ge=1, le=MAX_PAGE_SIZE, description="每页数量，最大 50"),
):
    data = await wx_scheme_service.list_schemes(
        user_id=user.id, page=page, size=size
    )
    return Success(data=data.model_dump(mode="json"))


@router.get("/{scheme_id}", summary="方案详情（仅创建者，含快照列表）")
async def scheme_detail(scheme_id: int, user: WxUser = DependWxAuth):
    data = await _translate_errors(
        lambda: wx_scheme_service.get_scheme_detail(scheme_id=scheme_id, user_id=user.id)
    )
    return Success(data=data.model_dump(mode="json"))


@router.get("/{scheme_id}/public", summary="分享回显（匿名只读，无创建者敏感信息）")
async def scheme_public(scheme_id: int):
    data = await _translate_errors(
        lambda: wx_scheme_service.get_public_scheme(scheme_id=scheme_id)
    )
    return Success(data=data.model_dump(mode="json"))


@router.put("/{scheme_id}", summary="更新方案（仅创建者，重新生成快照）")
async def update_scheme(
    scheme_id: int, body: SchemeUpdateIn, user: WxUser = DependWxAuth
):
    data = await _translate_errors(
        lambda: wx_scheme_service.update_scheme(
            scheme_id=scheme_id, user_id=user.id, payload=body
        )
    )
    return Success(data=data.model_dump(mode="json"))


@router.delete("/{scheme_id}", summary="删除方案（软删除，仅创建者）")
async def delete_scheme(scheme_id: int, user: WxUser = DependWxAuth):
    await _translate_errors(
        lambda: wx_scheme_service.soft_delete_scheme(
            scheme_id=scheme_id, user_id=user.id
        )
    )
    return Success(msg="已删除")


@router.post("/{scheme_id}/share", summary="分享计数 +1（仅创建者）")
async def share_scheme(scheme_id: int, user: WxUser = DependWxAuth):
    data = await _translate_errors(
        lambda: wx_scheme_service.share_scheme(scheme_id=scheme_id, user_id=user.id)
    )
    return Success(data=data.model_dump(mode="json"))
