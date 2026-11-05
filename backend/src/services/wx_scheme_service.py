"""wxapi 方案域业务编排（BE-06，V2.0 核心）。

核心不变量（aaa.md §4.3.1 / 核心约定 #10）：
- 创建/更新方案时固化产品当前展示状态为 JSON 快照写入
  gin_scheme_product.product_snapshot；此后产品任何修改不影响历史方案。
- 快照冻结字段见 _build_snapshot（SNAPSHOT_FIELDS）。

失败分支（路由层统一转 HTTP）：
- 方案不存在或已软删除 → SchemeNotFoundError（404）
- 非创建者访问 → SchemePermissionError（403）
- product_ids 含不存在产品 → SnapshotProductNotFoundError（404，事务回滚不留半成品）
"""

from typing import Any

from models.product import GinProduct
from models.scheme import GinScheme
from repositories.wx_scheme import wx_scheme_repository
from schemas.wx_scheme import (
    SchemeCreateIn,
    WxSchemeDetailOut,
    WxSchemeListItem,
    WxSchemePageOut,
    WxSchemeProductOut,
    WxSchemePublicOut,
    WxShareCountOut,
)

# 快照冻结的展示字段清单（对外文档/测试断言用）
SNAPSHOT_FIELDS: tuple[str, ...] = (
    "id",
    "category_id",
    "category_name",
    "name",
    "model",
    "slogan",
    "spec",
    "sleep_feel",
    "main_image",
    "detail_images",
    "real_images",
    "detail_content",
)


class SchemeNotFoundError(Exception):
    """方案不存在或已软删除（路由层 404）。"""


class SchemePermissionError(Exception):
    """非创建者操作他人方案（路由层 403）。"""


class SnapshotProductNotFoundError(Exception):
    """product_ids 中存在不存在的产品（路由层 404）。"""


def _dedupe_preserve_order(product_ids: list[int]) -> list[int]:
    """去重且保持传入顺序（sort 按此顺序固化）。"""
    seen: set[int] = set()
    ordered: list[int] = []
    for pid in product_ids:
        if pid not in seen:
            seen.add(pid)
            ordered.append(pid)
    return ordered


def _build_snapshot(product: GinProduct) -> dict[str, Any]:
    """固化产品当前展示状态（aaa.md §4.3.1：快照可完整还原产品详情）。"""
    return {
        "id": product.id,
        "category_id": product.category_id,
        "category_name": product.category.name if product.category else None,
        "name": product.name,
        "model": product.model,
        "slogan": product.slogan,
        "spec": product.spec,
        "sleep_feel": product.sleep_feel,
        "main_image": product.main_image,
        "detail_images": product.detail_images or [],
        "real_images": product.real_images or [],
        "detail_content": product.detail_content,
    }


async def _resolve_snapshots(
    product_ids: list[int],
) -> list[tuple[int, dict[str, Any]]]:
    """校验产品存在性并按传入顺序生成快照列表；任一缺失即 404（整体失败）。"""
    ordered_ids = _dedupe_preserve_order(product_ids)
    products = await wx_scheme_repository.get_products_by_ids(ordered_ids)
    by_id = {p.id: p for p in products}
    missing = [pid for pid in ordered_ids if pid not in by_id]
    if missing:
        raise SnapshotProductNotFoundError(f"产品不存在：{missing}")
    return [(pid, _build_snapshot(by_id[pid])) for pid in ordered_ids]


def _sorted_rows(scheme: GinScheme) -> list:
    return sorted(scheme.products or [], key=lambda r: (r.sort, r.id))


def _product_outs(scheme: GinScheme) -> list[WxSchemeProductOut]:
    return [
        WxSchemeProductOut(
            id=row.id,
            product_id=row.product_id,
            sort=row.sort,
            snapshot=row.product_snapshot,
        )
        for row in _sorted_rows(scheme)
    ]


def _detail_out(scheme: GinScheme) -> WxSchemeDetailOut:
    return WxSchemeDetailOut(
        id=scheme.id,
        title=scheme.title,
        remark=scheme.remark,
        product_count=scheme.product_count,
        share_count=scheme.share_count,
        create_time=scheme.created_at,
        products=_product_outs(scheme),
    )


def _list_item(scheme: GinScheme) -> WxSchemeListItem:
    rows = _sorted_rows(scheme)
    cover_image = None
    if rows:
        cover_image = (rows[0].product_snapshot or {}).get("main_image")
    return WxSchemeListItem(
        id=scheme.id,
        title=scheme.title,
        remark=scheme.remark,
        product_count=scheme.product_count,
        share_count=scheme.share_count,
        cover_image=cover_image,
        create_time=scheme.created_at,
    )


async def _load_owned_scheme(scheme_id: int, user_id: int) -> GinScheme:
    """取未删除方案并校验归属：不存在 404、非创建者 403。"""
    scheme = await wx_scheme_repository.get_visible_scheme(scheme_id)
    if scheme is None:
        raise SchemeNotFoundError("方案不存在或已删除")
    if scheme.user_id != user_id:
        raise SchemePermissionError("无权操作他人方案")
    return scheme


async def create_scheme(*, user_id: int, payload: SchemeCreateIn) -> WxSchemeDetailOut:
    """创建方案 + 固化快照（单事务；产品缺失整体失败不留半成品）。"""
    snapshots = await _resolve_snapshots(payload.product_ids)
    scheme = await wx_scheme_repository.create_scheme(
        user_id=user_id,
        title=payload.title,
        remark=payload.remark,
        snapshots=snapshots,
    )
    fresh = await wx_scheme_repository.get_visible_scheme(scheme.id)
    return _detail_out(fresh or scheme)


async def update_scheme(
    *, scheme_id: int, user_id: int, payload: SchemeCreateIn
) -> WxSchemeDetailOut:
    """整体替换更新：仅创建者；删旧快照行，按产品当前状态重新固化。"""
    await _load_owned_scheme(scheme_id, user_id)
    snapshots = await _resolve_snapshots(payload.product_ids)
    await wx_scheme_repository.replace_scheme_products(
        scheme_id=scheme_id,
        title=payload.title,
        remark=payload.remark,
        snapshots=snapshots,
    )
    fresh = await wx_scheme_repository.get_visible_scheme(scheme_id)
    if fresh is None:  # 理论不可达（刚校验过存在）；防御性 404
        raise SchemeNotFoundError("方案不存在或已删除")
    return _detail_out(fresh)


async def list_schemes(*, user_id: int, page: int, size: int) -> WxSchemePageOut:
    """当前用户方案列表（软删除不出现），create_time desc 分页。"""
    items, total = await wx_scheme_repository.list_user_schemes(
        user_id=user_id, page=page, size=size
    )
    return WxSchemePageOut(
        items=[_list_item(s) for s in items], total=total, page=page, size=size
    )


async def get_scheme_detail(*, scheme_id: int, user_id: int) -> WxSchemeDetailOut:
    """owner 详情（含快照列表）；非创建者 403。"""
    scheme = await _load_owned_scheme(scheme_id, user_id)
    return _detail_out(scheme)


async def get_public_scheme(*, scheme_id: int) -> WxSchemePublicOut:
    """分享回显（匿名只读）：不返回 user_id/openid，仅展示安全昵称。"""
    scheme = await wx_scheme_repository.get_visible_scheme(scheme_id)
    if scheme is None:
        raise SchemeNotFoundError("方案不存在或已删除")
    nickname = await wx_scheme_repository.get_user_nickname(scheme.user_id)
    return WxSchemePublicOut(
        id=scheme.id,
        title=scheme.title,
        remark=scheme.remark,
        product_count=scheme.product_count,
        share_count=scheme.share_count,
        nickname=nickname,
        create_time=scheme.created_at,
        products=_product_outs(scheme),
    )


async def share_scheme(*, scheme_id: int, user_id: int) -> WxShareCountOut:
    """分享计数 +1（仅创建者；原子自增，返回自增后的值）。"""
    await _load_owned_scheme(scheme_id, user_id)
    new_count = await wx_scheme_repository.increment_share_count(scheme_id)
    return WxShareCountOut(share_count=new_count)


async def soft_delete_scheme(*, scheme_id: int, user_id: int) -> None:
    """软删除（仅创建者）：置 deleted_at，行与快照保留供 BE-09 追溯。"""
    await _load_owned_scheme(scheme_id, user_id)
    await wx_scheme_repository.soft_delete_scheme(scheme_id)
