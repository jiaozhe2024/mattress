from sqlalchemy import select
from sqlalchemy.orm import selectinload

from core.crud import CRUDBase
from core.db import AsyncSessionFactory, db_session
from models.admin import Api, Menu, Role
from schemas.roles import RoleCreate, RoleUpdate
from utils.cache import clear_user_perms_cache_all


class RoleRepository(CRUDBase[Role, RoleCreate, RoleUpdate]):
    def __init__(self):
        super().__init__(model=Role)

    async def is_exist(self, name: str) -> bool:
        return await self.exists(where=[Role.name == name])

    async def get_with_relations(self, role_id: int) -> Role | None:
        """加载角色及其 menus/apis 关联（selectin，避免 N+1）。"""
        async with db_session() as session:
            stmt = (
                select(Role)
                .where(Role.id == role_id)
                .options(selectinload(Role.menus), selectinload(Role.apis))
            )
            return await session.scalar(stmt)

    async def update_roles(
        self, role: Role, menu_ids: list[int], api_infos: list[dict]
    ) -> None:
        """整体替换角色的菜单/API 关联（同一事务内完成）。"""
        async with AsyncSessionFactory() as session:
            stmt = (
                select(Role)
                .where(Role.id == role.id)
                .options(selectinload(Role.menus), selectinload(Role.apis))
            )
            role_obj = await session.scalar(stmt)
            if role_obj is None:
                raise ValueError(f"角色不存在: {role.id}")

            menus = (
                (await session.scalars(select(Menu).where(Menu.id.in_(menu_ids)))).all()
                if menu_ids
                else []
            )
            role_obj.menus = list(menus)

            api_conditions = [
                (Api.path == item.get("path"), Api.method == item.get("method"))
                for item in api_infos
                if item.get("path") and item.get("method")
            ]
            apis: list[Api] = []
            for path_cond, method_cond in api_conditions:
                api_obj = await session.scalar(
                    select(Api).where(path_cond, method_cond)
                )
                if api_obj is not None:
                    apis.append(api_obj)
            role_obj.apis = apis

            await session.commit()

        # 角色权限变更影响所有绑定该角色的用户，全量清除权限缓存
        await clear_user_perms_cache_all()


role_repository = RoleRepository()
