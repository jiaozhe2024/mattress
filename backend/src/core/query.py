"""查询条件构造 helper。

把 Django/Tortoise 风格的过滤 dict（如 `{"name__contains": "x", "status": 1}`）
转成 SQLAlchemy where 表达式列表，供 CRUDBase.list(where=[...]) 使用。
支持的 lookup 后缀：contains / icontains / startswith / endswith / gte / lte / gt / lt / range / in；
无后缀的 key 视为精确匹配（==）。各条件之间为 AND 关系。
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import and_
from sqlmodel import SQLModel

_LOOKUP_DELIMITER = "__"
_RANGE_SUFFIX = "range"
_IN_SUFFIX = "in"


def build_where(model: type[SQLModel], filters: dict[str, Any] | None) -> list[Any]:
    """Django 风格过滤 dict → SQLAlchemy where 表达式列表（AND 连接）。"""
    if not filters:
        return []

    clauses: list[Any] = []
    for key, value in filters.items():
        if value is None:
            continue
        parts = key.split(_LOOKUP_DELIMITER)
        field_name = parts[0]
        lookup = parts[1] if len(parts) > 1 else None

        column = getattr(model, field_name, None)
        if column is None:
            raise AttributeError(f"模型 {model.__name__} 没有字段: {field_name}")

        clauses.append(_apply_lookup(column, lookup, value))

    return clauses


def _apply_lookup(column: Any, lookup: str | None, value: Any) -> Any:
    if lookup == "contains":
        return column.contains(value)
    if lookup == "icontains":
        return column.icontains(value)
    if lookup == "startswith":
        return column.startswith(value)
    if lookup == "endswith":
        return column.endswith(value)
    if lookup == "gte":
        return column >= value
    if lookup == "gt":
        return column > value
    if lookup == "lte":
        return column <= value
    if lookup == "lt":
        return column < value
    if lookup == _RANGE_SUFFIX:
        return and_(column >= value[0], column <= value[1])
    if lookup == _IN_SUFFIX:
        return column.in_(value)
    # 无后缀：精确匹配
    return column == value


def keyword_or(model: type[SQLModel], keyword: str, fields: list[str]) -> Any:
    """对多个字段做 OR 模糊搜索（任一字段命中即匹配），返回单条 where 表达式。"""
    from sqlalchemy import or_

    return or_(
        *[_apply_lookup(getattr(model, f), "icontains", keyword) for f in fields]
    )
