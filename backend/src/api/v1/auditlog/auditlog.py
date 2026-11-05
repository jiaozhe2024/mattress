import json
from datetime import datetime

from fastapi import APIRouter, Query

from core.crud import CRUDBase
from models.admin import AuditLog
from schemas import SuccessExtra
from schemas.response import AuditLogListResponse

router = APIRouter()

# AuditLog 只读列表查询，直接复用 CRUDBase（无需独立 Repository）
audit_log_crud: CRUDBase = CRUDBase(AuditLog)


@router.get("/list", summary="查看操作日志", response_model=AuditLogListResponse)
async def get_audit_log_list(
    page: int = Query(1, description="页码"),
    page_size: int = Query(10, description="每页数量"),
    username: str = Query("", description="操作人名称"),
    module: str = Query("", description="功能模块"),
    method: str = Query("", description="请求方法"),
    summary: str = Query("", description="接口描述"),
    status: int = Query(None, description="状态码"),
    start_time: datetime = Query("", description="开始时间"),
    end_time: datetime = Query("", description="结束时间"),
):
    where = []
    if username:
        where.append(AuditLog.username.icontains(username))
    if module:
        where.append(AuditLog.module.icontains(module))
    if method:
        where.append(AuditLog.method.icontains(method))
    if summary:
        where.append(AuditLog.summary.icontains(summary))
    if status:
        where.append(AuditLog.status == status)
    if start_time and end_time:
        where.append(AuditLog.created_at >= start_time)
        where.append(AuditLog.created_at <= end_time)
    elif start_time:
        where.append(AuditLog.created_at >= start_time)
    elif end_time:
        where.append(AuditLog.created_at <= end_time)

    total, audit_log_objs = await audit_log_crud.list(
        page=page,
        page_size=page_size,
        where=where,
        order=[AuditLog.created_at.desc()],
    )
    data = [audit_log.to_dict() for audit_log in audit_log_objs]
    result = SuccessExtra(data=data, total=total, page=page, page_size=page_size)
    return json.loads(result.body)
