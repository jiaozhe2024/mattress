"""BE-02 演示数据 seed 入口（宿主执行）。

用法（backend/ 下）：
    DB_HOST=127.0.0.1 DB_PORT=13306 .venv/bin/python scripts/seed_demo_data.py

说明：backend/.env 的 DB_HOST=mysql 是容器内主机名；宿主执行必须用
compose 映射端口覆盖（DB_HOST=127.0.0.1 DB_PORT=13306）。
幂等：已有分类数据则跳过，不重复写入。
"""

import asyncio
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
SRC_DIR = BACKEND_DIR / "src"
for p in (str(BACKEND_DIR), str(SRC_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)


async def main() -> int:
    from core.db import AsyncSessionFactory, close_db
    from utils.demo_seed import seed_demo_data

    async with AsyncSessionFactory() as session:
        result = await seed_demo_data(session)
        await session.commit()
    await close_db()

    if result.skipped:
        print("seed 跳过：gin_product_category 已有数据（幂等保护）")
    else:
        print(
            "seed 完成："
            f"分类={result.categories} 产品={result.products} "
            f"banner={result.banners} 文章={result.articles} "
            f"品牌信息={result.brand_infos}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
