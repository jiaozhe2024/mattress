from typing import Optional

from sqlalchemy import select

from core.crud import CRUDBase
from core.db import db_session
from models.admin import Menu
from schemas.menus import MenuCreate, MenuUpdate


class MenuRepository(CRUDBase[Menu, MenuCreate, MenuUpdate]):
    def __init__(self):
        super().__init__(model=Menu)

    async def get_by_menu_path(self, path: str) -> Optional["Menu"]:
        async with db_session() as session:
            return await session.scalar(select(Menu).where(Menu.path == path))

    async def get_by_parent_id(self, parent_id: int) -> list["Menu"]:
        async with db_session() as session:
            return list(
                (
                    await session.scalars(
                        select(Menu).where(Menu.parent_id == parent_id).order_by(Menu.order)
                    )
                ).all()
            )

    async def count_by_parent_id(self, parent_id: int) -> int:
        from sqlalchemy import func

        async with db_session() as session:
            total = await session.scalar(
                select(func.count()).select_from(Menu).where(Menu.parent_id == parent_id)
            )
        return total or 0


menu_repository = MenuRepository()
