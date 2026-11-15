"""Admin 方案数据管理路由（BE-09）。

挂载：/api/v1/admin/schemes
鉴权：admin JWT + RBAC（v1_router 挂 DependPermisson，init_apis 启动同步）。
审计：HttpAuditLogMiddleware 自动记录，module=路由 tags。

管理员视图与用户侧的关键差异：
- 列表**包含**已软删除方案（deleted_at 非空），供数据追溯；
- 详情可查看已删方案，产品行一律取 product_snapshot（不回查实时产品，核心约定 10）；
- 删除为软删除（deleted_at=now），删除后 wxapi 列表不可见、public 接口 404。
"""

from datetime import datetime

from fastapi import APIRouter, Path, Query

from schemas.admin_system import AdminSchemeDetail, AdminSchemePage
from schemas.base import Success
from schemas.response import ResponseBase
from services import admin_system_service

router = APIRouter()


@router.get(
    "",
    summary="方案列表（按用户/日期/标题筛选，含已软删除）",
    response_model=ResponseBase[AdminSchemePage],
)
async def list_schemes(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=50),
    user_id: int | None = Query(None, description="按创建者 wx_user.id 筛选"),
    keyword: str = Query("", description="方案标题模糊搜索"),
    start_time: datetime | None = Query(None, description="创建时间起（含）"),
    end_time: datetime | None = Query(None, description="创建时间止（含）"),
):
    data = await admin_system_service.list_schemes(
        page=page,
        size=size,
        user_id=user_id,
        keyword=keyword,
        start_time=start_time,
        end_time=end_time,
    )
    return Success(data=data.model_dump(mode="json"))


@router.get(
    "/{scheme_id}",
    summary="方案详情（含快照产品列表；可查看已删方案）",
    response_model=ResponseBase[AdminSchemeDetail],
)
async def get_scheme_detail(scheme_id: int = Path(description="方案主键")):
    data = await admin_system_service.get_scheme_detail(scheme_id)
    return Success(data=data.model_dump(mode="json"))


@router.delete(
    "/{scheme_id}",
    summary="删除方案（软删除；删除后 wxapi public 接口 404）",
    response_model=ResponseBase[None],
)
async def delete_scheme(scheme_id: int = Path(description="方案主键")):
    await admin_system_service.delete_scheme(scheme_id)
    return Success(msg="已删除")
