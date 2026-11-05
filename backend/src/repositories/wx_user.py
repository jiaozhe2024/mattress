"""wx_user 数据访问层（BE-04）。

核心约定 #1：小程序用户只进 wx_user 表，永远不写基座 User（后台用户）表。
"""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from core.db import db_session
from models.wx_user import WxUser


class WxUserRepository:
    """wx_user 仓储。只操作 WxUser 模型，禁止引入 models.admin.User。"""

    async def get_by_openid(self, openid: str) -> WxUser | None:
        async with db_session() as session:
            return await session.scalar(select(WxUser).where(WxUser.openid == openid))

    async def get_by_id(self, wx_user_id: int) -> WxUser | None:
        async with db_session() as session:
            return await session.scalar(select(WxUser).where(WxUser.id == wx_user_id))

    async def get_or_create_by_openid(self, openid: str) -> WxUser:
        """按 openid 查用户，不存在则创建（首登自动注册）。

        并发兜底：openid 有唯一索引，同时首登的第二个事务会触发
        IntegrityError → 回查已存在的行，保证不重复建用户。
        """
        existing = await self.get_by_openid(openid)
        if existing is not None:
            return existing

        user = WxUser(openid=openid, status=1)
        try:
            async with db_session() as session:
                session.add(user)
                await session.flush()
        except IntegrityError:
            # 唯一索引冲突 = 并发下另一事务已创建，回查即可
            concurrent = await self.get_by_openid(openid)
            if concurrent is None:
                raise
            return concurrent
        return user

    async def touch_last_login(self, wx_user_id: int) -> None:
        async with db_session() as session:
            obj = await session.scalar(select(WxUser).where(WxUser.id == wx_user_id))
            if obj is not None:
                obj.last_login_at = datetime.now()


wx_user_repository = WxUserRepository()
