from datetime import datetime
from typing import Any

from pydantic import NaiveDatetime
from sqlalchemy import BigInteger, Text
from sqlalchemy.dialects import mysql
from sqlmodel import Field, SQLModel

from settings import settings

# MySQL 用 LONGTEXT 存富文本；sqlite（测试）回落为 TEXT
LongText = Text().with_variant(mysql.LONGTEXT(), "mysql")


class BaseModel(SQLModel):
    id: int | None = Field(default=None, primary_key=True, index=True)

    def to_dict(self, m2m: bool = False, exclude_fields: list[str] | None = None):
        """将模型序列化为 dict。

        - 时间字段按 settings.DATETIME_FORMAT 格式化
        - m2m=True 时遍历 self._m2m_relations 中声明的关系字段，逐个序列化
            与 Tortoise 版 to_dict 对齐，供 API 层直接使用。
        """
        if exclude_fields is None:
            exclude_fields = []

        d: dict[str, Any] = {}
        for field in type(self).model_fields:
            if field in exclude_fields:
                continue
            value = getattr(self, field)
            if isinstance(value, datetime):
                value = value.strftime(settings.DATETIME_FORMAT)
            d[field] = value

        if m2m:
            for field in getattr(self, "_m2m_relations", []):
                if field in exclude_fields:
                    continue
                values = getattr(self, field)
                fmt = []
                for item in values or []:
                    if hasattr(item, "to_dict"):
                        fmt.append(item.to_dict(exclude_fields=exclude_fields))
                    else:
                        fmt.append(item)
                d[field] = fmt
        return d

    class Config:
        arbitrary_types_allowed = True


class BusinessBaseModel(BaseModel):
    """gin_/wx_ 业务表基类。

    与基座 BaseModel 的区别：主键按 aaa.md §5 DDL 使用 BIGINT
    （基座表保持 INT 原样，不受影响）。
    """

    id: int | None = Field(
        default=None, primary_key=True, index=True, sa_type=BigInteger
    )


class UUIDModel(SQLModel):
    uuid: str = Field(default=None, unique=True, index=True)


class TimestampMixin(SQLModel):
    # NaiveDatetime：全项目统一使用本地 naive 时间（MySQL DATETIME 语义），
    # 兼容 sqlite（测试）——否则 SQLModel sqlite 方言要求 tz-aware 值。
    created_at: NaiveDatetime = Field(
        default_factory=datetime.now, index=True, description="创建时间"
    )
    updated_at: NaiveDatetime = Field(
        default_factory=datetime.now,
        sa_column_kwargs={"onupdate": datetime.now},
        index=True,
        description="更新时间",
    )