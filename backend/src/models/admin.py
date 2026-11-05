from typing import ClassVar, Optional

from pydantic import NaiveDatetime
from sqlalchemy import Column, JSON
from sqlmodel import Field, Relationship, SQLModel

from schemas.menus import MenuType

from .base import BaseModel, TimestampMixin
from .enums import MethodType


# ---------------- 多对多关联表（显式 link model） ----------------
class UserRole(SQLModel, table=True):
    """用户-角色关联表。"""

    user_id: int = Field(foreign_key="user.id", primary_key=True)
    role_id: int = Field(foreign_key="role.id", primary_key=True)


class RoleMenu(SQLModel, table=True):
    """角色-菜单关联表。"""

    role_id: int = Field(foreign_key="role.id", primary_key=True)
    menu_id: int = Field(foreign_key="menu.id", primary_key=True)


class RoleApi(SQLModel, table=True):
    """角色-接口关联表。"""

    role_id: int = Field(foreign_key="role.id", primary_key=True)
    api_id: int = Field(foreign_key="api.id", primary_key=True)


# ---------------- 主表 ----------------
class User(BaseModel, TimestampMixin, table=True):
    __tablename__ = "user"

    # to_dict(m2m=True) 序列化的关系字段清单
    # ClassVar：避免被 pydantic 当作实例私有属性（下划线开头）处理
    _m2m_relations: ClassVar[list[str]] = ["roles"]

    username: str = Field(max_length=20, unique=True, index=True, description="用户名称")
    alias: str | None = Field(default=None, max_length=30, index=True, description="姓名")
    email: str = Field(max_length=255, unique=True, index=True, description="邮箱")
    phone: str | None = Field(default=None, max_length=20, description="电话")
    password: str | None = Field(default=None, max_length=128, description="密码")
    is_active: bool = Field(default=True, index=True, description="是否激活")
    is_superuser: bool = Field(default=False, index=True, description="是否为超级管理员")
    last_login: NaiveDatetime | None = Field(default=None, index=True, description="最后登录时间")
    dept_id: int | None = Field(default=None, index=True, description="部门ID")

    roles: list["Role"] = Relationship(
        back_populates="users",
        link_model=UserRole,
        sa_relationship_kwargs={"lazy": "selectin"},
    )


class Role(BaseModel, TimestampMixin, table=True):
    __tablename__ = "role"

    _m2m_relations: ClassVar[list[str]] = ["menus", "apis"]

    name: str = Field(max_length=20, unique=True, index=True, description="角色名称")
    desc: str | None = Field(default=None, max_length=500, description="角色描述")

    users: list["User"] = Relationship(
        back_populates="roles", link_model=UserRole,
        sa_relationship_kwargs={"lazy": "noload"},
    )
    menus: list["Menu"] = Relationship(
        link_model=RoleMenu, sa_relationship_kwargs={"lazy": "selectin"}
    )
    apis: list["Api"] = Relationship(
        link_model=RoleApi, sa_relationship_kwargs={"lazy": "selectin"}
    )


class Api(BaseModel, TimestampMixin, table=True):
    __tablename__ = "api"

    path: str = Field(max_length=100, index=True, description="API路径")
    method: str = Field(max_length=10, index=True, description="请求方法")
    summary: str = Field(max_length=500, description="请求简介")
    tags: str = Field(max_length=100, description="API标签")


class Menu(BaseModel, TimestampMixin, table=True):
    __tablename__ = "menu"

    _m2m_relations: ClassVar[list[str]] = ["roles"]

    name: str = Field(max_length=20, index=True, description="菜单名称")
    remark: Optional[dict] = Field(default=None, sa_column=Column(JSON, nullable=True), description="保留字段")
    menu_type: str | None = Field(default=None, max_length=1, description="菜单类型")
    icon: str | None = Field(default=None, max_length=100, description="菜单图标")
    path: str = Field(max_length=100, index=True, description="菜单路径")
    order: int = Field(default=0, index=True, description="排序")
    parent_id: int = Field(default=0, description="父菜单ID")
    is_hidden: bool = Field(default=False, description="是否隐藏")
    component: str = Field(max_length=100, description="组件")
    keepalive: bool = Field(default=True, description="存活")
    redirect: str | None = Field(default=None, max_length=100, description="重定向")

    roles: list["Role"] = Relationship(
        back_populates="menus", link_model=RoleMenu,
        sa_relationship_kwargs={"lazy": "noload"},
    )


class Dept(BaseModel, TimestampMixin, table=True):
    __tablename__ = "dept"

    name: str = Field(max_length=20, unique=True, index=True, description="部门名称")
    desc: str | None = Field(default=None, max_length=500, description="备注")
    is_deleted: bool = Field(default=False, index=True, description="软删除标记")
    order: int = Field(default=0, index=True, description="排序")
    parent_id: int = Field(default=0, index=True, description="父部门ID")


class DeptClosure(BaseModel, TimestampMixin, table=True):
    __tablename__ = "deptclosure"
    ancestor: int = Field(index=True, description="父代")
    descendant: int = Field(index=True, description="子代")
    level: int = Field(default=0, description="深度")


class AuditLog(BaseModel, TimestampMixin, table=True):
    __tablename__ = "auditlog"

    user_id: int = Field(index=True, description="用户ID")
    username: str = Field(default="", max_length=64, index=True, description="用户名称")
    module: str = Field(default="", max_length=64, index=True, description="功能模块")
    summary: str = Field(default="", max_length=128, index=True, description="请求描述")
    method: str = Field(default="", max_length=10, index=True, description="请求方法")
    path: str = Field(default="", max_length=255, index=True, description="请求路径")
    status: int = Field(default=-1, description="状态码")
    response_time: int = Field(default=0, description="响应时间(单位ms)")
    request_args: Optional[dict] = Field(default=None, sa_column=Column(JSON, nullable=True), description="请求参数")
    response_body: Optional[dict] = Field(default=None, sa_column=Column(JSON, nullable=True), description="返回数据")


class FileMapping(BaseModel, TimestampMixin, table=True):
    """文件映射模型 - 管理文件ID和文件信息的映射关系。"""

    __tablename__ = "file_mapping"

    file_id: str = Field(max_length=255, unique=True, index=True, description="文件ID")
    original_filename: str = Field(max_length=255, description="原始文件名")
    file_type: str = Field(max_length=50, description="文件类型")
    file_size: int | None = Field(default=None, description="文件大小(字节)")
    upload_user_id: int = Field(index=True, description="上传用户ID")
    file_path: str | None = Field(default=None, max_length=500, description="本地文件路径")
