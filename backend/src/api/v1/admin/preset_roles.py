"""预置角色只读视图路由（BE-09）。

挂载：/api/v1/admin/preset-roles

为什么单独一个只读接口：预置角色（超级管理员/内容管理员/运营人员）需要「一键落库 +
按职责绑菜单」，但角色的增删改本身走基座 /api/v1/role。本接口只回答
「三个预置角色现在落库了没、各绑了哪些菜单」，供前端展示与校验，不做写入。
写入动作在 init_preset_roles（启动 seed），幂等。
"""

from fastapi import APIRouter

from schemas.admin_system import PresetRoleItem
from schemas.base import Success
from schemas.response import ResponseBase
from services import admin_system_service

router = APIRouter()


@router.get(
    "",
    summary="预置角色落库状态与菜单绑定",
    response_model=ResponseBase[list[PresetRoleItem]],
)
async def list_preset_roles():
    data = await admin_system_service.list_preset_roles()
    return Success(data=[item.model_dump(mode="json") for item in data])
