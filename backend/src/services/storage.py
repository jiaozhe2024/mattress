"""图片存储 OSS 适配层（BE-08）。

设计：
- StorageAdapter 抽象接口：save_image(content, ext) -> 可访问 URL。
- LocalStorageAdapter（本地 mock 存储，当前唯一实现）：
  写入 settings.UPLOAD_DIR/images/ 目录（与 file_service 相同的 uploads 相对路径约定），
  由 create_app 中 StaticFiles 挂载 settings.UPLOAD_URL_PREFIX 对外提供访问，
  返回相对 URL（如 /uploads/images/xxx.png）。
- OssAdapter 预留位：生产接入阿里云 OSS/腾讯云 COS 时实现同接口，
  经 settings.STORAGE_DRIVER 切换，业务代码不感知存储细节。

异步红线（核心约定 #8）：磁盘写入通过 anyio.to_thread 放入线程池，
不在事件循环内做同步阻塞 IO。
"""

import uuid
from abc import ABC, abstractmethod
from pathlib import Path

import anyio.to_thread
from fastapi import HTTPException

from settings.config import settings

# 仅允许图片扩展名（管理端内容上传；.svg 可携带脚本，禁止）
ALLOWED_IMAGE_EXTENSIONS: frozenset[str] = frozenset(
    {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}
)


class StorageAdapter(ABC):
    """存储适配器接口：业务层只依赖该抽象，不依赖具体存储实现。"""

    @abstractmethod
    async def save_image(self, content: bytes, ext: str) -> str:
        """保存图片字节流，返回可访问 URL。"""


class LocalStorageAdapter(StorageAdapter):
    """本地目录 mock 存储：UPLOAD_DIR/images/ + StaticFiles URL 映射。"""

    def __init__(self, base_dir: str | None = None, url_prefix: str | None = None):
        self.base_dir = Path(base_dir or settings.UPLOAD_DIR) / "images"
        self.url_prefix = (url_prefix or settings.UPLOAD_URL_PREFIX).rstrip("/")

    def _write_sync(self, file_path: Path, content: bytes) -> None:
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(content)

    async def save_image(self, content: bytes, ext: str) -> str:
        ext = ext.lower()
        if ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的图片格式: {ext}，允许: {', '.join(sorted(ALLOWED_IMAGE_EXTENSIONS))}",
            )
        if len(content) > settings.MAX_IMAGE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"图片大小超过限制 {settings.MAX_IMAGE_SIZE // (1024 * 1024)}MB",
            )
        if not content:
            raise HTTPException(status_code=400, detail="图片内容为空")
        filename = f"{uuid.uuid4().hex}{ext}"
        file_path = self.base_dir / filename
        await anyio.to_thread.run_sync(self._write_sync, file_path, content)
        return f"{self.url_prefix}/images/{filename}"


def get_storage() -> StorageAdapter:
    """按 settings.STORAGE_DRIVER 返回存储适配器（工厂）。"""
    driver = settings.STORAGE_DRIVER.lower()
    if driver == "local":
        return LocalStorageAdapter()
    raise HTTPException(
        status_code=500,
        detail=f"未实现的存储驱动: {driver}（当前仅支持 local，OSS 为预留位）",
    )
