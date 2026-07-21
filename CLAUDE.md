# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

**唐小识无人运力配送小程序** — 一个 pnpm monorepo,由两大部分组成:

- **根目录**(`/`):Taro 4 + React 18 + TypeScript 多端前端(微信小程序 / 抖音小程序 / H5)
- **`server/`**:NestJS 10 后端服务(端口 3000,路由前缀 `/api`)

业务包含三类订单:按趟散单(`single`)、包月专线咨询单(`monthly`)、租车购车咨询单(`rental`)。9 个车型(`z2`/`z5-2026`/`l5`/`l5-max`/`z8`/`z8-max`/`z5-c`/`z8-max-c`/`z5-multi`)。订单状态:`pending`/`accepted`/`in_progress`/`completed`/`cancelled`。

完整开发规范见 `AGENTS.md` 与 `assets/AGENTS.md`(两者内容一致,后者会被构建流程复制到 `assets/`),设计系统与品牌色见 `DESIGN.md`,功能方案见 `assets/详细地址功能实施方案.md`,**面向扣子编程 Agent 的三端贯通步骤与故障排查见 `INTEGRATION.md`(必读)**。**`AGENTS.md` 中的"网络请求规范"与"H5/小程序跨端兼容性"为强约束**。

## 常用命令

```bash
# 安装(必须 pnpm,preinstall 钩子禁止 npm/yarn)
pnpm install

# 本地开发
pnpm dev                  # 同时启动 H5 (5000) + NestJS (3000)
pnpm dev:web              # 仅 H5,监听
pnpm dev:weapp            # 仅微信小程序,监听
pnpm dev:tt               # 仅抖音小程序,监听
pnpm dev:server           # 仅 NestJS,热重载

# 构建
pnpm build                # 全量:lint + tsc + web + weapp + tt + server
pnpm build:web            # → dist-web/
pnpm build:weapp          # → dist/
pnpm build:tt             # → dist-tt/
pnpm build:server         # → server/dist/
pnpm preview:weapp        # 构建并生成预览二维码

# 校验(提交前必跑)
pnpm validate             # eslint(0 warning) + tsc --noEmit
pnpm lint / pnpm lint:fix # 仅 ESLint
pnpm tsc                  # 仅类型检查

# 工具
pnpm new                  # 交互式创建页面/组件(taro new)
npx kill-port 3000        # 端口被占时清理
pnpm kill:all             # 一键清掉所有 concurrently/nest/taro 进程
npx taro-lucide-find --json <icons>   # 验证 lucide-react-taro 图标是否存在
npx taro-lucide-tabbar <Names> -c #999 -a #2088D8 -o ./src/assets/tabbar  # 生成 TabBar PNG
```

> 没有测试框架 — 项目当前未配置测试脚本。

## 高层架构

### 前端(`src/`)

```
src/
├── app.tsx / app.config.ts    # 应用入口 + 路由注册 + TabBar 配置
├── network.ts                  # Network 命名空间:封装 Taro.request/uploadFile/downloadFile,自动拼 PROJECT_DOMAIN。禁止修改
├── components/ui/             # shadcn/ui Taro 版(47 个组件),所有通用 UI 必须从这里取
├── pages/
│   ├── index/                 # 下单页(选车型 + 地址簿选点)
│   ├── orders/                # 订单列表
│   ├── profile/               # 个人中心
│   ├── address/{list,edit}/   # 地址簿(地图选点 + 门牌/联系人/电话 Input)
│   ├── order/                 # 订单详情
│   └── vehicle/               # 车型详情
├── stores/address.ts          # zustand,地址簿内存 + Taro.setStorageSync 持久化(key: address_list)
├── utils/
│   ├── amap.ts                # chooseLocation、AddressInfo、formatFullAddress、isValidPhone
│   └── pricing.ts             # 前端参考计价(正式应由服务端完成)
├── constants/order-status.ts   # 订单状态/类型常量(前后端共享权威来源,后端 enum 必须与之对齐)
├── data/vehicles.ts           # 车型静态数据
└── lib/                       # 工具库
```

路径别名 `@/*` → `src/*`。Zustand 状态管理、Tailwind CSS 4 + weapp-tailwindcss、图标用 `lucide-react-taro`(不是 `lucide-react`)。

### 后端(`server/src/`)

```
server/src/
├── main.ts                    # bootstrap,CORS + setGlobalPrefix('api') + 50mb body + HttpStatusInterceptor(POST 201→200)
├── app.module.ts              # 根模块,导入 Orders/Config/Vehicles 三个模块
├── orders/                    # orders.controller.ts/service.ts/types.ts(内存 Map 存储,Three endpoints: single/monthly/rental)
├── vehicles/                  # vehicles.controller.ts/service.ts(硬编码车型数据,GET /vehicles, /vehicles/logistics, /vehicles/rental)
├── config/                    # 计价配置 + 客服联系方式配置(内存 CRUD)
└── interceptors/http-status.interceptor.ts  # 统一 POST 响应为 200
```

**当前后端全部使用内存存储**,无数据库。Drizzle ORM 0.45 + `pg` 已安装但未接线;Drizzle Kit 仅在 devDependencies。**没有鉴权**(所有 Controller 文件头部均标注"⚠️ 开发阶段原型接口 - 当前使用内存存储,无鉴权,不可作为生产接口开放")。

后端 TypeScript 路径别名:`@/*` → `server/src/*`。

## 关键约定(摘自 AGENTS.md,踩坑必读)

1. **后端路由禁止硬编码 `api`**:全局 `setGlobalPrefix('api')`,Controller 装饰器写 `@Controller('orders')` 而非 `@Controller('api/orders')`。
2. **POST 必须显式返回 200**:用 `@HttpCode(HttpStatus.OK)` 或由 `HttpStatusInterceptor` 兜底。响应统一信封 `{ code, msg, data }`。
3. **前端请求统一用 `Network`**:`import { Network } from '@/network'`。URL 用 `/api/xxx` 相对路径(Vite 代理到 3000);严禁硬编码 `localhost`、`example.com`、直接 `Taro.request`、直接 `fetch`。`src/network.ts` 不要修改。
4. **响应解包双重 `data`**:`res.data.data` 才是业务数据(`res.data` 是 HTTP body)。先 `console.log(res.data)` 确认结构,再用可选链。
5. **UI 组件优先 `@/components/ui`**:`pnpm validate` 会在页面级 ESLint 兜底,直接用原生 `Input` 或用 `View/Text` 手搓通用 UI 会失败。组件库缺失时先补到 `src/components/ui`,不要在页面里造轮子。
6. **样式优先 Tailwind,禁止任意值**:禁用 `w-[340px]`、`text-[14px]`、`style={{ width: '200px' }}` 这类硬编码。跨端单位由 Taro pxtransform 自动转换。
7. **图片走 TOS**:仅 TabBar PNG(`src/assets/tabbar/`)可放本地;其他图片/视频用 TOS 返回的 URL,代码引用。
8. **平台检测直接判断**:`const isWeapp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP`,**禁止** `useState + useEffect` 异步设置(会导致 H5 白屏)。
9. **跨端 Input/Textarea 坑**:H5 端 Input 是 inline,样式会失效,必须 `<View className=...><Input className="w-full bg-transparent" /></View>` 包裹,样式放外层 View。
10. **Fixed+Flex 坑**:H5 端 Tailwind `fixed bottom-0 flex` 失效且被 TabBar 遮挡,必须 inline `style={{ position: 'fixed', bottom: 50, display: 'flex' }}`。
11. **包管理器锁死 pnpm**:`preinstall` 钩子用 `only-allow pnpm`,npm/yarn 会直接报错。

## 环境变量

`.env.local`(勿提交)与 `.env.example` 模板:

```
LOCATION_APIKEY=your_location_api_key_here   # 腾讯位置服务 WebServiceAPI Key(用于里程计算)
```

后端环境变量计划:`server/.env` 中 `PORT`、`WX_APP_ID`、`WX_APP_SECRET`、`JWT_SECRET`(目前 `.env` 文件未创建)。

## 品牌色 / 设计 Token

主色冰川蓝 `#2088D8`(Tailwind `bg-blue-600`)、底色星海白 `#F8FAFB`(`bg-slate-50`)、点缀极光青 `#06B6D4`(`bg-cyan-500`)。语义色:成功 `emerald-500`、警告 `amber-500`、错误 `red-500`。详见 `DESIGN.md`。