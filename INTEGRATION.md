# Coze 编程环境集成手册

> 本手册面向在 **扣子编程 (Coze Coding)** 容器内运行本仓库的 Agent,目标是把三端同时拉通:
>
> 1. 后端 (NestJS + Supabase/Postgres)
> 2. 用户端小程序 (Taro 多端编译产物)
> 3. 管理后台 (admin-web / Vite + React)
>
> 代码已在 `https://github.com/200420052024xw-dot/tangship.git` 的 `main` 分支维护。

---

## 0. 三端进程一览

| 进程       | 命令                                     | 端口 | 角色                              |
| ---------- | ---------------------------------------- | ---- | --------------------------------- |
| 后端       | `pnpm dev:server`                        | 3000 | NestJS API + 静态后台 `/admin/`   |
| 后台前端   | `pnpm dev:admin`                         | 5174 | Vite HMR(`/admin/` 已在 Vite 中 base) |
| 用户端 H5  | `pnpm dev:web`                           | 5000 | Taro H5 dev(含 Vite 代理到 3000)  |
| 用户端 weapp | `pnpm dev:weapp` → 微信开发者工具导入    | -    | 编译产物在 `dist/`,需扫码预览     |
| 用户端 tt  | `pnpm dev:tt` → 抖音开发者工具导入       | -    | 编译产物在 `dist-tt/`             |

> ⚠️ **永远不要混跑 `pnpm dev:admin:local`**:那个命令会硬编码 `ADMIN_DATA_BACKEND=sqlite`,并把一切写入本地 sqlite 文件,**不会与 Coze 上的 Supabase 同步**。在 Coze 容器里请直接用 `pnpm dev:server` / `pnpm dev:admin`。

## 1. 数据后端:扣子编程默认就是 Supabase

NestJS 在 `server/src/admin-data/admin-data.service.ts:30` 通过环境变量切后端:

```ts
this.mode = process.env.ADMIN_DATA_BACKEND === 'sqlite' ? 'sqlite' : 'supabase';
```

> 留空或为 `supabase` → 走 Coze 自带的 Supabase 项目。
> 设为 `sqlite` → 走本地 `server/data/admin-local.sqlite`(仅 `NODE_ENV !== 'production'` 才允许)。

### 1.1 Supabase 凭据来源(`server/src/storage/database/supabase-client.ts`)

`loadEnv()` 启动时会按下列顺序找一个 Supabase 客户端:

1. 进程环境里已经有 `COZE_SUPABASE_URL` + `COZE_SUPABASE_ANON_KEY` (Coze 容器默认就注入了)。
2. 否则退到 `python3 -c "from coze_workload_identity import Client; ... get_project_env_vars()"`,从 Coze 工作负载身份里读。
3. 都拿不到就直接抛 `COZE_SUPABASE_URL is not set`。

> 在 Coze 里通常**步骤 1 就足够**;若看到此错误,在 Coze 工作区 → Project Settings → Database / Supabase 里确认项目已绑定。

> 需要绕过 RLS 的场景会用到 `COZE_SUPABASE_SERVICE_ROLE_KEY`(可选,留空则用 anon key)。

### 1.2 首次启动自动 seed

`server/src/main.ts:72-75` 在非 sqlite 模式下调用 `seedSupabase(supabaseService)`,把车辆/横幅/初始管理员写入远端 Postgres。**所以新 clone 后直接启动后端就够了**,不必手动跑迁移。

如果中途需要重置:

```bash
pnpm db:admin:reset     # 仅在本地 sqlite 模式有效
# 在 Coze 环境如需重建结构,在 Supabase 控制台执行:
#   server/supabase/migrations/20260720_admin_parity.sql
```

## 2. 环境变量矩阵

`server/src/main.ts` 会在启动时 `dotenv` 加载项目根 `.env.local`(gitignored)。下面按"必填/可选/扣子侧自动注入"分类:

### 2.1 必填 (扣子编程会注入)

| 变量                            | 来源                       | 用途                                            |
| ------------------------------- | -------------------------- | ----------------------------------------------- |
| `COZE_SUPABASE_URL`             | 扣子编程自动注入           | Supabase 项目入口                                |
| `COZE_SUPABASE_ANON_KEY`        | 扣子编程自动注入           | 公开读写 key                                     |
| `COZE_SUPABASE_SERVICE_ROLE_KEY`| 可选,扣子编程可注入        | 绕过 RLS,服务端优先使用                         |
| `NODE_ENV`                       | 扣子编程容器默认非 prod    | sqlite 仅在 `!== 'production'` 时允许           |

### 2.2 可选 (按需配置)

| 变量                            | 用途                                       | 在哪用                          |
| ------------------------------- | ------------------------------------------ | ------------------------------- |
| `LOCATION_APIKEY`               | 腾讯位置服务 WebServiceAPI Key(里程计算)   | `server/src/` 里后端调用        |
| `WECHAT_APP_ID` / `WECHAT_APP_SECRET` | 微信小程序 `code2Session`              | `server/src/auth/`              |
| `TOS_ACCESS_KEY` / `TOS_SECRET_KEY` / `TOS_REGION` / `TOS_ENDPOINT` / `TOS_BUCKET` / `TOS_PUBLIC_BASE_URL` | 火山引擎 TOS 图片/视频上传 | `server/src/storage/` + `coze-coding-dev-sdk` |
| `ADMIN_ALLOWED_ORIGINS`         | CORS 白名单 origin,逗号分隔               | `server/src/main.ts`            |
| `SQLITE_BUSY_TIMEOUT_MS`        | 本地 sqlite 锁等待,默认 5000              | `admin-data.service.ts`         |
| `ADMIN_SQLITE_DB_PATH`          | 本地 sqlite 文件路径,默认 `./server/data/admin-local.sqlite` | 同上                |

> 如果 Coze 项目还没绑 TOS,`/api/admin/operations/upload` 这类上传会 503,后台 UI 会自动隐藏"上传"按钮 (`runtime().capabilities.assetUpload === false`),**不需要也不应该去硬填**。

### 2.3 用户端 / 管理端的运行环境注入

| 端             | 变量                   | 注入方式                                       |
| -------------- | ---------------------- | ---------------------------------------------- |
| Taro 全平台    | `PROJECT_DOMAIN`       | Taro 编译时全局常量,被 `src/network.ts` 拼到所有 `/api/*` 前面 |
| 微信小程序     | `wx.appid` 等          | `project.config.json` / `project.private.config.json` |
| 抖音小程序     | 同上                   | `project.tt.json`                              |
| admin-web      | `VITE_API_BASE_URL`    | `admin-web/.env.example` 默认留空,Vite 通过 `/api` 代理到 `http://localhost:3000` |

> ⚠️ `src/network.ts` 不允许修改 —— `Network.request / uploadFile / downloadFile` 是唯一允许的请求入口。详见 `AGENTS.md` 的"网络请求规范"。

## 3. 三端贯通步骤 (Agent 视角)

按顺序执行,每一步都有验证手段。

### 3.1 后端拉起

```bash
pnpm install                    # pnpm 被 preinstall 钩子锁死,不要混用 npm/yarn
pnpm dev:server &               # nest start --watch,默认 3000

# 验证 1
curl -s http://localhost:3000/api/health          # → {"status":"ok",...} 或 controller 返回
# 验证 2(检查数据后端确实是 Supabase,而不是 sqlite)
curl -s http://localhost:3000/api/admin/runtime   # → dataMode: "supabase"
```

预期日志(节选):

```
[dotenv@17.x] injecting env (...) from ../.env.local
[Nest]  Starting Nest application...
[NestApplication] Nest application successfully started
Server running on http://localhost:3000
Admin web served at /admin/                        # 如果 server/public/admin/ 已存在
```

如果日志里出现 `[AdminData] SQLite mode: ...` → **立刻停**并检查环境,sqlite 后端不会与 Coze 共享数据。

### 3.2 后台前端

```bash
pnpm dev:admin &
# 浏览器打开 http://localhost:5174/admin/  → 看到登录页
# 演示账号在 Coze 模式下也是 seed 出来的 super_admin
```

如果 Seed 完成后管理后台拿不到账号,在 Supabase 控制台的 `admin_users` 表手工插入:

```sql
-- 密码哈希算法见 server/src/auth/security.ts (PBKDF2-SHA256)
-- 也可走 pnpm db:init-admin 在 dist 已构建的情况下生成
```

### 3.3 用户端 H5 / weapp / tt

H5:

```bash
pnpm dev:web &          # 5000,内含 Vite proxy → 3000
# 浏览器开 http://localhost:5000
```

> Taro 编译时会注入 `PROJECT_DOMAIN`,H5 取值来自 Vite 代理,所以**不需要在 H5 改任何后端地址**。

weapp:

```bash
pnpm dev:weapp          # 输出到 dist/,微信开发者工具导入 dist/ 目录
# project.config.json → miniprogramRoot: dist/
# 微信开发者工具要求合法域名(用于 /api/*),把 dev 服务域名加入"开发服务器域名"
```

tt: 同 weapp,但产物是 `dist-tt/`,工具换成抖音开发者工具。

### 3.4 跨端打通自查清单

1. **H5 → 后端**:在 5000 选地址簿选一个,看 network 是否打到 `/api/addresses`,后端 log 是否有对应请求。
2. **小程序 → 后端**:用 `project.private.config.json` 把 `requestLegalDomain` 指向 3000 端口或 ngrok/cpolar 隧道(扣子编程内自带 `*.dev.coze.site` 子域名已加入 CORS 白名单,见 `server/src/main.ts:39`)。
3. **后台 → 后端**:登录后看 dashboard,`GET /api/admin/dashboard` 返回 200。
4. **端到端**:下一单 → 后台 `/api/admin/orders` 应能查到。

## 4. 路由&接口速查

后端统一前缀 `/api`(除 `/admin/*` 静态资源外)。Controller 完整清单以 `server/src/admin-data.service.ts` 启动时打印的 `Mapped {...}` 日志为准,这里给出按端分类的入口:

### 4.1 用户端 (Taro)

| 路径                           | 方法      | 说明                                            |
| ------------------------------ | --------- | ----------------------------------------------- |
| `/api/auth/dev-login`          | POST      | `ENABLE_DEV_AUTH=true` 时调试登录               |
| `/api/auth/wechat-login`       | POST      | 微信 code 换 session                            |
| `/api/auth/me`                 | GET/PATCH | 当前用户                                        |
| `/api/addresses`               | CRUD      | 地址簿                                          |
| `/api/orders`                  | GET/POST  | 散单 / 包月 / 租车                              |
| `/api/orders/:id`              | GET       | 订单详情                                        |
| `/api/orders/:id/cancel`       | POST      | 取消                                            |
| `/api/orders/:id/pay`          | POST      | 支付(占位)                                     |
| `/api/content/vehicles`        | GET       | 车型列表(公开)                                 |
| `/api/content/contact`         | GET       | 客服联系方式                                    |
| `/api/content/pricing/preview` | POST      | 试算报价                                        |
| `/api/content/inquiries`       | POST      | 提交咨询单                                      |

### 4.2 管理端 (admin-web)

| 路径                                       | 方法      | 说明                |
| ------------------------------------------ | --------- | ------------------- |
| `/api/admin/auth/login`                    | POST      | 用户名密码登录      |
| `/api/admin/auth/wechat-session`           | POST      | 微信扫码             |
| `/api/admin/dashboard`                     | GET       | 仪表盘              |
| `/api/admin/orders` + `:id`                | GET       | 订单列表 / 详情     |
| `/api/admin/orders/:id/review`             | POST      | 审核                |
| `/api/admin/orders/:id/status`             | POST      | 状态机推进          |
| `/api/admin/operations/vehicles`           | GET/PUT   | 运营配置车型        |
| `/api/admin/operations/banners`            | GET/PUT   | 横幅                |
| `/api/admin/operations/pricing`            | GET       | 计价配置(草稿/发布)|
| `/api/admin/operations/upload`             | POST      | TOS 上传(需 TOS 凭据) |

### 4.3 后台同源代理

`admin-web/vite.config.ts` 已配置 `proxy['/api'] → http://localhost:3000`,所以后台开发期不需要 `VITE_API_BASE_URL`。

生产同源:后端 `app.useStaticAssets('public/admin', { prefix: '/admin/' })` + SPA fallback,**直接部署 `server/` 即可**,无需额外 nginx。

## 5. Coze 环境特有的"不要"

1. **不要硬编码任何 origin**:`ADMIN_ALLOWED_ORIGINS` 默认含 `http://localhost:5174`,Coze 容器里的 `*.dev.coze.site` 已在 `server/src/main.ts:39-41` 的开发分支里被放行,无需改代码。
2. **不要改 `src/network.ts`**:Taro 全局 `PROJECT_DOMAIN` 是构建期注入的,直接改它会让所有 dev/构建分支破裂。
3. **不要在 Coze 容器里设 `ADMIN_DATA_BACKEND=sqlite`**:sqlite 模式在 `NODE_ENV === 'production'` 时会直接抛错 `admin-data.service.ts:32`,且数据不会同步。
4. **不要把 `.env.local` 进 git**:`.gitignore:13` 已屏蔽;若 git status 出现此文件名 → 立刻 `git rm --cached .env.local`。
5. **不要创建同名 admin_user**:种子脚本 (`server/src/supabase/seed.ts`) 已注入 `super_admin`,重复跑前先在 Supabase 控制台清表。

## 6. 故障排查速查

| 现象                                 | 排查方向                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `COZE_SUPABASE_URL is not set`       | Coze 项目是否绑定 Supabase;工作负载身份服务可达                                                     |
| 后台 dashboard 返回 403              | 没有 super_admin role;在 Supabase `admin_users` 表里把当前账号 `role` 改 `super_admin`             |
| 上传图片 503 / 后台"上传"按钮灰     | TOS 凭据未注入;调用 `/api/admin/runtime` 看 `capabilities.assetUpload`                              |
| H5 跨域失败                         | 后端 CORS 白名单;`ADMIN_ALLOWED_ORIGINS` 是否包含 5000                                              |
| 小程序请求失败                       | `project.private.config.json` 的 `requestLegalDomain` / `uploadFileDomain` 没把后端域名加进去     |
| 订单计价一直 0                      | `LOCATION_APIKEY` 没填,里程算不出 → 试算走默认价                                                    |

## 7. 一句话总结

```
pnpm install && pnpm dev:server         # 后端:3000,自动连 Coze 的 Supabase
pnpm dev:admin                          # 后台前端:5174
pnpm dev:web                            # 用户端 H5:5000
# 或 pnpm dev:weapp / pnpm dev:tt → 用开发者工具扫码
```
