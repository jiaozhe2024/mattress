from sqlalchemy import delete, select

from core.crud import CRUDBase
from core.db import db_session
from log import logger
from models.admin import Dept, DeptClosure
from schemas.depts import DeptCreate, DeptUpdate


class DeptRepository(CRUDBase[Dept, DeptCreate, DeptUpdate]):
    def __init__(self):
        super().__init__(model=Dept)

    async def get_dept_tree(self, name: str | None = None) -> list[dict]:
        """获取部门树（未软删除，按 order 升序）。"""
        async with db_session() as session:
            stmt = select(Dept).where(Dept.is_deleted == False).order_by(Dept.order)  # noqa: E712
            if name:
                stmt = stmt.where(Dept.name.contains(name))
            all_depts = (await session.scalars(stmt)).all()

        def build_tree(parent_id: int) -> list[dict]:
            return [
                {
                    "id": dept.id,
                    "name": dept.name,
                    "desc": dept.desc,
                    "order": dept.order,
                    "parent_id": dept.parent_id,
                    "children": build_tree(dept.id),
                }
                for dept in all_depts
                if dept.parent_id == parent_id
            ]

        return build_tree(0)

    async def get_dept_info(self):
        pass

    async def _update_dept_closure(self, session, obj: Dept) -> None:
        """在同一会话内写入部门闭包关系。"""
        parent_depts = (
            await session.scalars(
                select(DeptClosure).where(DeptClosure.descendant == obj.parent_id)
            )
        ).all()
        for i in parent_depts:
            logger.debug(
                f"Processing dept closure: ancestor={i.ancestor}, descendant={i.descendant}"
            )
        closure_objs = [
            DeptClosure(
                ancestor=item.ancestor, descendant=obj.id, level=item.level + 1
            )
            for item in parent_depts
        ]
        closure_objs.append(DeptClosure(ancestor=obj.id, descendant=obj.id, level=0))
        session.add_all(closure_objs)

    async def create_dept(self, obj_in: DeptCreate) -> None:
        async with db_session() as session:
            if obj_in.parent_id != 0:
                parent = await session.scalar(
                    select(Dept).where(Dept.id == obj_in.parent_id)
                )
                if parent is None:
                    raise ValueError(f"父部门不存在: {obj_in.parent_id}")
            new_obj = Dept(**obj_in.model_dump())
            session.add(new_obj)
            await session.flush()
            await self._update_dept_closure(session, new_obj)

    async def update_dept(self, obj_in: DeptUpdate) -> None:
        async with db_session() as session:
            dept_obj = await session.scalar(select(Dept).where(Dept.id == obj_in.id))
            if dept_obj is None:
                raise ValueError(f"部门不存在: {obj_in.id}")
            if dept_obj.parent_id != obj_in.parent_id:
                await session.execute(
                    delete(DeptClosure).where(DeptClosure.ancestor == dept_obj.id)
                )
                await session.execute(
                    delete(DeptClosure).where(DeptClosure.descendant == dept_obj.id)
                )
                for field, value in obj_in.model_dump(exclude_unset=True).items():
                    setattr(dept_obj, field, value)
                await session.flush()
                await self._update_dept_closure(session, dept_obj)
            else:
                for field, value in obj_in.model_dump(exclude_unset=True).items():
                    setattr(dept_obj, field, value)

    async def delete_dept(self, dept_id: int) -> None:
        async with db_session() as session:
            obj = await session.scalar(select(Dept).where(Dept.id == dept_id))
            if obj is None:
                return
            obj.is_deleted = True
            await session.execute(
                delete(DeptClosure).where(DeptClosure.descendant == dept_id)
            )


dept_repository = DeptRepository()
