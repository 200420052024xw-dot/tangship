# 扣子编程集成手册

本项目由 Taro 小程序、NestJS API 和独立管理后台组成。本地开发与扣子部署统一使用 Supabase 作为数据后端，图片和视频统一使用火山引擎 TOS。

## 1. 启动方式

| 目标 | 命令 | 默认地址 |
| --- | --- | --- |
| 用户端 H5 + API | `pnpm dev` | H5 由 Taro 输出，API 为 `http://localhost:3000` |
| API | `pnpm dev:server` | `http://localhost:3000` |
| 管理后台 | `pnpm dev:admin:local` | `http://localhost:5174/admin/` |
| 微信小程序 | `pnpm dev:weapp` | 导入 `dist/` |
| 抖音小程序 | `pnpm dev:tt` | 导入 `dist-tt/` |

所有命令必须使用 pnpm。

## 2. Supabase 配置

服务端从项目根目录 `.env.local` 读取：

```env
COZE_SUPABASE_URL=
COZE_SUPABASE_ANON_KEY=
COZE_SUPABASE_SERVICE_ROLE_KEY=
```

- `COZE_SUPABASE_URL` 和 `COZE_SUPABASE_ANON_KEY` 为必填项。
- `COZE_SUPABASE_SERVICE_ROLE_KEY` 用于服务端管理操作，建议配置。
- 扣子容器可通过工作负载身份自动注入同名变量。
- 不要把服务端密钥放进 Taro 或管理后台构建变量。
- `.env.local` 已被 Git 忽略，禁止提交。

客户端创建逻辑位于 `server/src/storage/database/supabase-client.ts`。服务启动时会执行 `server/src/supabase/seed.ts`，以幂等方式初始化必要运营数据。

数据库结构调整统一维护在：

```text
server/supabase/migrations/
```

## 3. 其他环境变量

| 变量 | 用途 |
| --- | --- |
| `NODE_ENV` | 运行环境 |
| `ENABLE_DEV_AUTH` | 非生产环境的开发身份开关 |
| `WECHAT_APP_ID` / `WECHAT_APP_SECRET` | 微信登录 |
| `ADMIN_ALLOWED_ORIGINS` | 管理后台 CORS 白名单 |
| `INIT_ADMIN_USERNAME` / `INIT_ADMIN_PASSWORD` | 首次初始化管理员 |
| `TOS_ACCESS_KEY` / `TOS_SECRET_KEY` | TOS 访问凭据 |
| `TOS_REGION` / `TOS_ENDPOINT` / `TOS_BUCKET` / `TOS_PUBLIC_BASE_URL` | TOS 存储配置 |
| `LOCATION_APIKEY` | 腾讯位置服务 |

## 4. 本地验证

```bash
pnpm install
pnpm validate
pnpm build:backend
pnpm dev:admin:local
```

启动后可检查：

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/admin/runtime
```

管理端接口统一使用 `/api/admin/**`，成功响应使用 HTTP 200，并返回 `{ code, msg, data }` 信封。

## 5. 小程序网络

后端已通过 `app.setGlobalPrefix('api')` 添加全局前缀，Controller 路径中不要重复写 `api`。

前端必须使用：

```ts
import { Network } from '@/network'
```

请求 URL 使用 `/api/xxx` 相对路径，不要硬编码 localhost 或生产域名。H5 开发代理、生产域名和小程序域名由项目配置统一处理。

## 6. TOS 资源

除微信小程序 TabBar 本地图标外，图片和视频必须上传到 TOS，并在数据库中保存 TOS 返回的 URL。管理后台上传接口为：

```text
POST /api/admin/operations/upload
```

TOS 未配置时，上传接口会返回明确错误；不要使用占位图服务或虚构本地路径。

## 7. 部署检查

部署前执行：

```bash
pnpm install
pnpm validate
pnpm build
```

同时确认：

- 三个 Supabase 变量已正确注入。
- 生产环境关闭 `ENABLE_DEV_AUTH`。
- 微信 AppSecret 和服务端数据库密钥仅存在于服务端环境。
- TOS 桶、Endpoint 和公开访问域名配置正确。
- 管理后台允许来源已加入 `ADMIN_ALLOWED_ORIGINS`。
- 小程序 request 合法域名已配置。
