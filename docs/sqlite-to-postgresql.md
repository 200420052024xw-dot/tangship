# SQLite 到 PostgreSQL 迁移

当前 SQLite 适合单实例开发和早期试运营，不是未来多实例商用部署的最终数据库。

迁移时保留 UUID 文本 ID、整数分金额、整数米距离和 UTC ISO-8601 时间语义：

1. 执行 `pnpm --filter server db:export -- sqlite-export.json` 得到按表分组的标准 JSON。
2. 为 PostgreSQL 新建同名 Drizzle schema；将 UUID 文本列改为 `uuid`（或先保留 `text`），UTC 文本时间改为 `timestamptz`，金额和距离使用 `integer/bigint`。
3. 按 users/admin_users → sessions/addresses/orders → snapshots/items/quotes/logs/payments/audit_logs 顺序导入。
4. 在事务中导入，随后核对每表行数、外键、订单报价金额和状态日志链。
5. 新建 PostgreSQL Repository 实现并替换依赖注入绑定；控制器和业务服务不变。

切换前应进行双写或停机增量导出，并用订单 ID、用户隔离查询和有效报价校验做抽样验收。
