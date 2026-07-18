# SQLite 备份与恢复

备份不会停止服务，使用 SQLite 在线备份 API 生成一致性快照：

```bash
pnpm db:backup
```

默认写入 `server/backups/`，该目录不会进入 Git 或源码交付包。

恢复前必须停止 NestJS 服务，并确认备份来自可信位置：

```bash
pnpm db:restore -- path/to/app.db.backup --confirm
```

恢复脚本先备份当前数据库，再恢复指定文件并执行 `PRAGMA integrity_check`。不要手工复制正在运行的 WAL 数据库，也不要删除现有 `.db`、`-wal` 或 `-shm` 文件。
