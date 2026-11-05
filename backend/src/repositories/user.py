import secrets
import string
from datetime import datetime
from typing import Optional

from fastapi.exceptions import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from core.crud import CRUDBase
from core.db import AsyncSessionFactory, db_session
from models.admin import Role, User
from schemas.login import CredentialsSchema
from schemas.users import UserCreate, UserUpdate
from utils.cache import cache_manager
from utils.password import get_password_hash, verify_password


class UserRepository(CRUDBase[User, UserCreate, UserUpdate]):
    def __init__(self):
        super().__init__(model=User)

    async def get_by_email(self, email: str) -> User | None:
        async with db_session() as session:
            return await session.scalar(select(User).where(User.email == email))

    async def get_by_username(self, username: str) -> User | None:
        async with db_session() as session:
            return await session.scalar(
                select(User).where(User.username == username)
            )

    async def create_user(self, obj_in: UserCreate) -> User:
        create_data = obj_in.model_dump(exclude={"role_ids"})
        create_data["password"] = get_password_hash(password=obj_in.password)
        return await self.create(create_data)

    async def update_last_login(self, id: int) -> None:
        async with db_session() as session:
            obj = await session.scalar(select(User).where(User.id == id))
            if obj is not None:
                obj.last_login = datetime.now()

    async def authenticate(self, credentials: CredentialsSchema) -> Optional["User"]:
        async with db_session() as session:
            user = await session.scalar(
                select(User).where(User.username == credentials.username)
            )
            if not user:
                raise HTTPException(status_code=400, detail="无效的用户名")
            if not user.password:
                raise HTTPException(status_code=400, detail="用户未设置密码")
            verified = verify_password(credentials.password, user.password)
            if not verified:
                raise HTTPException(status_code=400, detail="密码错误!")
            if not user.is_active:
                raise HTTPException(status_code=400, detail="用户已被禁用")
            return user

    async def update_roles(self, user: User, role_ids: list[int]) -> None:
        """整体替换用户-角色关联（同一事务内完成）。"""
        async with AsyncSessionFactory() as session:
            stmt = (
                select(User)
                .where(User.id == user.id)
                .options(selectinload(User.roles))
            )
            user_obj = await session.scalar(stmt)
            if user_obj is None:
                raise HTTPException(status_code=404, detail="用户不存在")
            roles = (
                (
                    await session.scalars(
                        select(Role).where(Role.id.in_(role_ids))
                    )
                ).all()
                if role_ids
                else []
            )
            user_obj.roles = list(roles)
            await session.commit()
        await cache_manager.delete(f"user_perms:{user.id}")

    async def reset_password(self, user_id: int) -> str:
        """重置用户密码，返回新密码"""
        user_obj = await self.get(id=user_id)
        if user_obj is None:
            raise HTTPException(status_code=404, detail="用户不存在")
        if user_obj.is_superuser:
            raise HTTPException(status_code=403, detail="不允许重置超级管理员密码")
        # 生成安全的随机密码
        new_password = self._generate_secure_password()
        async with db_session() as session:
            obj = await session.scalar(select(User).where(User.id == user_id))
            obj.password = get_password_hash(password=new_password)
        return new_password

    def _generate_secure_password(self, length: int = 12) -> str:
        """生成安全的随机密码"""
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        password = "".join(secrets.choice(alphabet) for _ in range(length))
        return password


user_repository = UserRepository()
