# 唐师傅管理员端：SQLite 本地过渡与扣子迁移交接

## Resume Prompt

请在 `F:\projects` 继续唐师傅管理员端工作：先阅读 `docs/coze-admin-migration-handoff.md`，保持本地管理员测试使用 SQLite、扣子生产使用 Supabase，按文档的“扣子 Agent 执行顺序”完成 Supabase 预检、执行幂等迁移、构建部署和线上验收。禁止导入 `server/data/admin-local.sqlite` 的任何测试记录，也禁止生产启用 SQLite。

## Project Paths

- 根目录：`F:\projects`
- 微信小程序：`F:\projects\src`
- 管理员前端：`F:\projects\admin-web`
- NestJS 后端：`F:\projects\server`
- SQLite 管理员仓库：`F:\projects\server\src\admin-data`
- Supabase 幂等迁移：`F:\projects\server\supabase\migrations\20260720_admin_parity.sql`
- 扣子部署脚本：`F:\projects\.cozeproj\scripts`

## Current Objective

让管理员端可在本机完整测试，同时保持微信小程序及扣子生产数据库继续使用 Supabase。SQLite 是可重置的本地演示层，不是生产数据库，也不是离线生产数据副本。

## Governing Principle for Future Admin Work

- 管理端功能必须脱离扣子编程也能开发、启动、测试和验收；不能把扣子在线环境当作日常开发前置条件。
- 扣子只承担部署和线上资源适配，不承载不可替代的业务规则。页面、Controller、校验、权限和订单状态机不得直接调用扣子 SDK。
- 新管理功能先定义稳定的服务/仓库接口并完成 SQLite 本地实现，再补 Supabase、TOS 等线上适配和幂等迁移。
- 前后端 API 契约在本地与线上保持一致；切换数据源不应要求修改管理员页面。
- 线上迁移必须有环境变量清单、数据库变更文件、验收步骤和回滚说明，确保未来也能迁移到非扣子环境。

## Decisions

- `ADMIN_DATA_BACKEND=sqlite`：只接管 `/api/admin/**` 的本地管理功能。
- `ADMIN_DATA_BACKEND=supabase` 或未设置：管理端使用现有 Supabase；生产必须使用此模式。
- `NODE_ENV=production` 与 SQLite 同时出现时，后端直接拒绝启动。
- 小程序用户认证、地址、下单、支付和公共内容接口仍使用 Supabase，不改为 SQLite。
- 本地不执行图片上传，不向 TOS 写入测试文件；真实上传只在线上联调。
- 本地 SQLite 记录永不导入 Supabase，只迁移代码和表结构。
- 管理员前端生产产物与 NestJS 同源部署在 `/admin/`，避免跨站 Cookie 问题。
- 后续新增能力继续沿用“本地独立实现 + 可替换线上适配器”结构，不在业务层新增扣子专属依赖。

## Local Test Workflow

```bash
pnpm install
pnpm dev:admin:local
```

- 管理端：`http://localhost:5174/admin/`
- API：`http://localhost:3000/api`
- 默认账号：`wjf`
- 默认密码：`123`
- 本地数据库：`F:\projects\server\data\admin-local.sqlite`

如需清空演示数据：

```bash
pnpm db:admin:reset
pnpm dev:admin:local
```

重置脚本只允许删除 `server/data/admin-local.sqlite` 及其 `-wal`、`-shm` 文件。必须先停止本地后端，否则 Windows 会因文件锁拒绝删除。

可用环境变量：

```dotenv
ADMIN_DATA_BACKEND=sqlite
ADMIN_SQLITE_DB_PATH=./server/data/admin-local.sqlite
SQLITE_BUSY_TIMEOUT_MS=5000
LOCAL_ADMIN_USERNAME=wjf
LOCAL_ADMIN_PASSWORD=123
```

最后两个变量只允许用于非生产 SQLite 演示模式。

## Architecture and Data Boundary

- `AdminDataService` 统一管理员认证会话和本地管理数据操作。
- SQLite 启动时启用 foreign keys、WAL 和 busy timeout，然后幂等建表、填充演示数据。
- SQLite 管理表包括：admin users/sessions、微信授权、用户、订单、订单地址、物品、报价、状态日志、审核日志、管理员通知、车型、图片元数据、轮播、计费版本、咨询、联系方式。
- 订单批准/拒绝在一个 SQLite 事务中写入订单状态、报价、状态日志和审核日志；已审核订单再次提交返回 HTTP 409。
- 审核批准时记录 `reserved_vehicle_count`。该值只用于提醒管理员安排车辆，不是强制库存锁；订单完成后归零。
- 按趟订单的管理员履约状态机为 `paid -> dispatching -> delivering -> completed`。安排车辆时必须填写实际派车数量、车牌选填；完成时填写说明，当前版本暂不要求图片凭证。
- `AdminAuthGuard` 通过数据模式解析管理员会话；Cookie 中保存原始随机 token，数据库只保存 SHA-256 hash。
- `/api/admin/runtime` 返回 `dataMode`、`localOnly` 以及 `assetUpload`/`wechatSession` 能力。
- 车型编辑器使用现有 `vehicle_catalog` JSON 字段承载完整小程序详情参数，不新增数据库列。`PUT /api/admin/operations/vehicles/:id` 可携带 `syncModes: ('single'|'monthly'|'rental')[]`；服务端以无后缀基础 ID 表示按趟车型，并按 `<基础ID>-monthly`、`<基础ID>-rental` 幂等创建或更新其他模式副本，同时同步 `vehicle_images` 元数据。图片对象仍复用同一 TOS Key，不复制本地文件；删除单张图片时只有在没有其他车型继续引用该 Key 后才删除 TOS 对象。
- SQLite 上传接口返回 `LOCAL_UPLOAD_DISABLED`，管理员页面显示本地模式提示。

## Admin API Contract

所有成功响应继续使用 `{ code: 200, msg, data }`。

- `POST /api/admin/auth/login`
- `GET /api/admin/auth/me`
- `POST /api/admin/auth/logout`
- `GET /api/admin/runtime`
- `GET /api/admin/dashboard`
- `GET /api/admin/orders`
- `GET /api/admin/orders/:id`
- `POST /api/admin/orders/:id/review`
- `POST /api/admin/orders/:id/status`
- `GET /api/admin/reviews`
- `GET /api/admin/notifications`
- `PUT /api/admin/notifications/:id/read`
- `PUT /api/admin/notifications/read-all`
- `GET /api/admin/wechat-users`
- `POST|PATCH|DELETE /api/admin/wechat-bindings[...]`
- `GET|PUT|DELETE /api/admin/operations/vehicles[...]`
- `POST /api/admin/operations/vehicles/:id/images`、`DELETE /api/admin/operations/vehicles/:id/images/:imageId`
- `GET|PUT /api/admin/operations/banners[...]`
- `GET|PUT|POST /api/admin/operations/pricing[...]`
- `GET /api/admin/operations/inquiries` 返回分页对象 `{ items,total,page,pageSize,totalPages }`
- `PUT /api/admin/operations/inquiries/:id/status`
- `GET|PUT /api/admin/operations/contact` 的 `data` 是联系方式对象，不是数组

## Supabase Schema Mapping

线上代码使用以下规范字段：

- `audit_logs.target_type`
- `audit_logs.target_id`
- `audit_logs.detail`（JSON 字符串）
- `admin_wechat_bindings.granted_by`
- `admin_wechat_bindings.updated_at`
- `admin_wechat_bindings.revoked_at`
- `vehicle_catalog.service_mode`
- `orders.mode`
- `orders.scheduled_end_at`
- `orders.internal_note`
- `orders.user_note`
- `orders.reserved_vehicle_count`
- `orders.dispatch_note`
- `orders.dispatch_vehicle_count`
- `orders.vehicle_plate`
- `orders.completion_note`
- `orders.completion_proof_url`
- `vehicle_catalog.total_count`
- `admin_users.nickname`（为空时由用户名回填）
- `admin_notifications` 管理员站内通知表
- `inquiries` 完整咨询表
- `contact_settings` 单行联系方式表

旧代码或旧表可能仍存在 `resource_type/resource_id/detail_json`。迁移文件会动态检测旧列并回填规范字段；新代码只写规范字段。

## Coze Agent Execution Order

1. 在扣子工作区拉取本提交，确认工作区无未识别的用户改动。
2. 确认生产环境存在 `COZE_SUPABASE_URL`、`COZE_SUPABASE_ANON_KEY`；服务端写操作应有平台身份或 `COZE_SUPABASE_SERVICE_ROLE_KEY`。只确认变量存在，不打印值。
3. 设置 `NODE_ENV=production`、`ADMIN_DATA_BACKEND=supabase`。不要设置 `ADMIN_SQLITE_DB_PATH`。
4. 在 Supabase SQL Editor 先执行下方预检查询并保存结果。
5. 执行 `server/supabase/migrations/20260720_admin_parity.sql`。脚本为加法迁移，可重复执行。
6. 再次执行预检，确认规范字段与表存在；抽查历史 `audit_logs` 已回填。
7. 使用 `pnpm install`，禁止 npm/yarn。
8. 执行 `pnpm validate`、`pnpm --filter server test`、`pnpm build:backend`；发布前再执行根目录 `pnpm build`。
9. 确认 `server/dist/src/main.js` 和 `server/dist/public/admin/index.html` 同时存在。
10. 按 `.cozeproj/scripts/deploy_run.sh` 启动；确认日志没有 SQLite 模式文字。
11. 打开线上 `/admin/`，按“Online Acceptance”验收。

## Supabase Preflight

```sql
select table_name
from information_schema.tables
where table_schema='public'
  and table_name in (
    'admin_users','admin_sessions','admin_wechat_bindings','users','orders',
    'order_addresses','order_items','order_quotes','order_status_logs','audit_logs',
    'vehicle_catalog','vehicle_images','content_banners','pricing_rule_versions',
    'inquiries','contact_settings','admin_notifications'
  )
order by table_name;

select table_name,column_name,data_type,is_nullable
from information_schema.columns
where table_schema='public'
  and (
    (table_name='audit_logs' and column_name in ('target_type','target_id','detail','resource_type','resource_id','detail_json'))
    or (table_name='admin_wechat_bindings' and column_name in ('granted_by','updated_at','revoked_at'))
    or (table_name='vehicle_catalog' and column_name in ('service_mode','total_count'))
    or (table_name='admin_users' and column_name='nickname')
    or (table_name='orders' and column_name in ('mode','scheduled_end_at','internal_note','user_note','reserved_vehicle_count','dispatch_note','dispatch_vehicle_count','vehicle_plate','completion_note','completion_proof_url'))
  )
order by table_name,column_name;
```

执行迁移后检查：

```sql
select count(*) as missing_audit_targets
from public.audit_logs
where target_type is null or target_id is null or detail is null;
```

结果必须为 `0`。

## Online Acceptance

- `/api/health` 返回 HTTP 200。
- `/admin/` 返回管理员 SPA，刷新任意 hash 路由不丢失页面。
- 管理员登录、`/auth/me` 恢复 Cookie、退出后会话不可复用。
- `/runtime` 返回 `dataMode=supabase`、`assetUpload=true`、`localOnly=false`。
- 工作台和订单筛选分页正常。
- 选一条测试订单完成批准或拒绝；状态、报价、状态日志、审核日志一致。
- 批准时填写参考占车数量，车型页面和工作台的预占/可用参考数量同步变化。
- 对已支付订单依次执行派车、配送、完成；派车数量缺失或完成说明缺失时必须拒绝，完成后参考占车数量释放。当前版本不验收完成图片上传。
- 对同一订单重复审核返回 409。
- 审核记录显示订单号、审核人、金额或拒绝原因。
- 微信用户授权、改角色和撤销正常，非超级管理员返回 403。
- 新增未被订单引用的测试车型后可删除；已被订单引用的车型删除返回 409，只允许下架。
- 在车型编辑器拖动左侧把手后刷新，排序必须保持；同步区域始终显示当前栏目之外的两个目标模式，从按趟、包月或租赁任一栏目同步后，目标车型中的文字、参数、适用场景、起送价格和图片引用必须与源车型一致，`service_mode`/`modes_json` 必须分别保持目标模式。
- 车型预览支持多图轮播；右下角“图片管理”弹窗可添加、查看和逐张删除图片。删除被多个服务车型复用的图片时不得误删仍在使用的 TOS 对象。
- 车辆/轮播图上传写入 TOS，并保存真实对象 URL/Key；不得产生本地静态图片。
- 计费草稿保存、预览、发布正常，版本冲突返回 409。
- 咨询状态和客服联系方式保存后刷新仍保持。
- Web 与管理员小程序通知中心可查看未读通知、单条已读和全部已读；包月/租购待办可进入对应咨询列表。

## Rollback

- 数据库迁移只新增字段、表和索引；出现应用故障时优先回滚应用版本，不删除新增结构。
- 将扣子服务重新部署到上一个已验证提交，并保持 `ADMIN_DATA_BACKEND=supabase`。
- 不要把 `audit_logs` 已回填的数据反向清空，也不要删除 `inquiries/contact_settings`，除非已完成独立备份并获得明确授权。
- 如果只有管理员静态页面异常，可重新执行 `pnpm build:backend` 并确认构建顺序为“先 server、后 admin”。

## Current State

- 已实现 SQLite 管理员数据仓库、自动建表、演示种子、生产禁用保护和安全重置脚本。
- 已修复登录会话 hash、微信授权更新、车型删除、咨询分页、联系方式结构和审核记录映射。
- 已修复管理员静态构建目录及扣子运行入口 `server/dist/src/main.js`。
- 已添加 Supabase 幂等迁移文件。
- Web 左侧导航按业务域分为五组，每个栏目独占一行；工作台、订单履约、客户跟进、小程序运营和系统管理不再挤在同一页。
- “车型与数量”已改为左侧拖拽排序、右侧模拟小程序车型详情的预览式编辑器；每个车型单独维护小程序展示用的起送价格，包含公里数已删除，实际订单的距离、附加费和核价规则继续在“价格与计费”栏目维护。
- 管理员小程序已增加包月/租购咨询、通知中心、车辆参考数量，并在订单审核中记录参考占车数量。
- 本地订单履约已支持派车、配送、完成与完成后释放参考车辆数量。
- 管理端详情已增加五步流程、地址复制、坐标距离估算、派车数量/车牌和管理员昵称显示；咨询详情已拆除重复类型切换并增加电话复制。
- `pnpm validate` 已通过。
- `pnpm --filter server test` 已通过：2 个测试，覆盖审核占车、重复审核、派车数量与车牌、履约状态机、完成说明、车辆释放、通知已读和会话。
- `pnpm --filter admin-web build` 已通过。
- `pnpm build:weapp` 已通过；为修复项目既有 Babel 配置缺少直接依赖，已声明 `@babel/plugin-proposal-decorators@7.28.0`。
- `pnpm build` 全量生产构建已通过，包含 H5、微信、抖音、后端和管理员静态资源。
- 本地 API 实测通过：登录、runtime、dashboard、订单列表、审核、重复审核 409、微信授权更新、车型新增/删除。
- `curl --noproxy '*'` 实测 `/admin/` 与 `/api/health` 均返回 HTTP 200。

## Pitfalls

- Windows 上 SQLite 文件被后端占用时无法重置，先停止 `pnpm dev:admin:local`。
- 当前 Node 20 会显示 Supabase SDK 的弃用提示；部署环境应升级到 Node 22，但该提示不阻断现有构建测试。
- 终端可能配置 HTTP 代理；访问 localhost 时用浏览器或 `curl --noproxy '*'`，否则可能看到代理制造的 404/502。
- `server` 构建会清理 `server/dist`，所以管理员前端必须在 server 构建之后输出到 `server/dist/public/admin`。
- `.env.local` 已被 Git 忽略，禁止把 Supabase/TOS/微信密钥写入文档或提交。
- 本地图片上传被刻意禁用，不是待修复缺陷。
- 当前自动化环境没有可连接的内置浏览器；已完成构建、HTTP、CSS 布局和 API 验证，最终视觉与点击流程需由本机浏览器手工走一遍。
