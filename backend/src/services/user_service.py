"""用户服务层 - 统一用户业务逻辑"""

from core.query import build_where
from models.admin import User
from repositories.dept import dept_repository
from repositories.user import user_repository
from schemas.base import Fail, Success, SuccessExtra
from schemas.users import UserCreate, UserUpdate
from services.base_service import BaseService
from utils.cache import cached, clear_user_cache


class UserService(BaseService):
    """用户服务类 - 专门处理用户相关业务逻辑"""

    def __init__(self):
        super().__init__(user_repository)

    async def get_user_list(
        self,
        page: int = 1,
        page_size: int = 10,
        username: str = "",
        email: str = "",
        dept_id: int | None = None,
    ) -> SuccessExtra:
        """获取用户列表 - 包含搜索过滤和部门信息关联"""
        try:
            filters: dict = {}
            if username:
                filters["username__contains"] = username
            if email:
                filters["email__contains"] = email
            if dept_id is not None:
                filters["dept_id"] = dept_id
            where = build_where(User, filters)

            total, items = await self.repository.list(
                page=page,
                page_size=page_size,
                where=where,
                order=[User.created_at.desc()],
            )

            data = await self._transform_user_list_with_dept(items)
            return SuccessExtra(data=data, total=total, page=page, page_size=page_size)

        except Exception as e:
            self.logger.error(f"获取用户列表失败: {str(e)}")
            return Fail(msg="获取用户列表失败")

    @cached("user_detail", ttl=300)
    async def get_user_detail(self, user_id: int) -> Success:
        """获取用户详情 - 带缓存"""
        try:
            user_obj = await user_repository.get(id=user_id)
            if not user_obj:
                return Fail(msg="用户不存在")

            user_dict = user_obj.to_dict(m2m=True, exclude_fields=["password"])
            return Success(data=user_dict)

        except Exception as e:
            self.logger.error(f"获取用户详情失败: {str(e)}")
            return Fail(msg="获取用户详情失败")

    async def create_user(self, user_in: UserCreate) -> Success:
        """创建用户 - 包含邮箱唯一性检查和角色分配"""
        try:
            existing_user = await user_repository.get_by_email(user_in.email)
            if existing_user:
                return Fail(
                    code=400,
                    msg="The user with this email already exists in the system.",
                )

            new_user = await user_repository.create_user(obj_in=user_in)
            await user_repository.update_roles(new_user, user_in.role_ids or [])
            return Success(msg="Created Successfully")

        except Exception as e:
            self.logger.error(f"创建用户失败: {str(e)}")
            return Fail(msg="创建用户失败")

    async def update_user(self, user_in: UserUpdate) -> Success:
        """更新用户 - 包含角色更新和缓存清理"""
        try:
            user = await user_repository.update(id=user_in.id, obj_in=user_in)
            if user is None:
                return Fail(msg="用户不存在")

            await user_repository.update_roles(user, user_in.role_ids or [])
            await clear_user_cache(user_in.id)
            return Success(msg="Updated Successfully")

        except Exception as e:
            self.logger.error(f"更新用户失败: {str(e)}")
            return Fail(msg="更新用户失败")

    async def delete_user(self, user_id: int) -> Success:
        """删除用户 - 包含缓存清理"""
        try:
            await user_repository.remove(id=user_id)
            await clear_user_cache(user_id)
            return Success(msg="Deleted Successfully")

        except Exception as e:
            self.logger.error(f"删除用户失败: {str(e)}")
            return Fail(msg="删除用户失败")

    async def reset_user_password(self, user_id: int) -> Success:
        """重置用户密码"""
        try:
            await user_repository.reset_password(user_id)
            return Success(msg="密码已重置")

        except Exception as e:
            self.logger.error(f"重置密码失败: {str(e)}")
            return Fail(msg="重置密码失败")

    async def _transform_user_list_with_dept(self, items) -> list[dict]:
        """转换用户列表数据并关联部门信息"""
        data = []
        for obj in items:
            user_dict = obj.to_dict(m2m=True, exclude_fields=["password"])
            dept_id = user_dict.pop("dept_id", None)
            if dept_id:
                dept_obj = await dept_repository.get(id=dept_id)
                user_dict["dept"] = dept_obj.to_dict() if dept_obj else {}
            else:
                user_dict["dept"] = {}
            data.append(user_dict)
        return data


# 全局实例
user_service = UserService()
