# 技术债务跟踪

> 初始为空。开发过程中发现的债务按 `[优先级: 高/中/低] 问题 — 影响范围` 追加。

| 优先级 | 问题 | 影响范围 | 发现于 | 修法建议 |
|-------|------|---------|--------|---------|
| 中 | ~~已修复（BE-10，2026-11-14）~~ sqlite 测试库索引名撞名：`BaseModel.id` 用 `Field(primary_key=True, index=True)` 为每表生成 `ix_<table>_id`，而 `gin_product.category_id` 也 `index=True` 生成同名 `ix_gin_product_category_id`，与 `gin_product_category.id` 的同名索引在 **SQLite 索引名库级全局唯一**下冲突 → `rm test.db` 后单独跑任一测试报 `OperationalError: index ... already exists`（全表 ERROR）。MySQL 索引名表级隔离不受影响（容器迁移/生产无感）；pytest 全量绿是因残留旧 test.db 被 checkfirst 跳过建表，掩盖了干净环境的必然失败 | 所有依赖 sqlite 全新建库的场景（CI、新机器、`rm test.db` 后跑单个测试文件）；不影响 MySQL 生产 | BE-06 验收（Hermes 独立复跑时发现） | **实际修法（BE-10）**：`gin_product.category_id` 改用 `sa_column=Column(BigInteger, ForeignKey(...))` + `__table_args__=(Index("ix_gin_product_category_fk", "category_id"),)`；MySQL 索引名表级隔离故无新迁移；已验证 `rm test.db` 后单跑 4 个分类相关测试文件全绿 |
| 低 | 品牌加盟电话校验只允许纯数字（6-20 位），行业惯例通常允许 `-`/`+`/空格分隔。当前 seed 已改成纯数字规避冲突，但未来若用户填带连字符/加号的号码会被拦截。是否放宽校验规则需业务决策（BE-08 交付时 CC 主动标注了此风险） | 品牌信息配置模块的加盟电话字段 | BE-08 验收（Hermes） | 业务确认电话格式后，前端校验规则改为允许 `^[\d\-+()\s]{6,20}$` |
