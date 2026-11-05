"""服务层基类 - 统一公共依赖（repository + logger）。

SQLModel 改造后，分页/CRUD 的通用逻辑下沉到 core.crud.CRUDBase，
Service 层只承载具体业务编排，因此这里只保留最小基类。
"""

from core.crud import CRUDBase
from log import logger
from models.admin import User
from schemas.base import Fail


class BaseService:
    """基础服务类 - 统一公共逻辑"""

    def __init__(self, repository: CRUDBase):
        self.repository = repository
        self.logger = logger


class PermissionService:
    """权限服务 - 统一权限检查逻辑"""

    @staticmethod
    async def check_superuser(
        user: User, error_msg: str = "权限不足，需要超级管理员权限"
    ) -> Fail | None:
        """检查超级管理员权限，非超管返回 Fail(403)。"""
        if not user.is_superuser:
            return Fail(code=403, msg=error_msg)
        return None


# 全局实例
permission_service = PermissionService()
