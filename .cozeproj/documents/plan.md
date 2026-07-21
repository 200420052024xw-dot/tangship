# 微信登录完善 + 数据清理方案

## 概述

项目**已实现用户隔离和微信登录基础流程**，但上线前需完善：补全微信登录配置、创建缺失的登录页面、清理所有模拟数据。平台：mobile（小程序）。

## 现状分析

### 用户隔离：✅ 已实现
- `UserAuthGuard` 校验 Bearer token → 提取 `req.user.id`
- `OrdersController`、`AddressesController` 均用 `@UseGuards(UserAuthGuard)` + `req.user.id` 过滤数据
- 每个用户的订单、地址完全隔离，无法越权访问

### 微信登录：✅ 后端已实现，但前端有缺口
- 后端 `POST /api/auth/wechat-login` 已完成：code → openid → 用户创建/更新 → session 签发
- 前端 `consumer-api.ts` 已实现：WEAPP 环境自动调 `Taro.login()` → 发送 code 到后端
- **缺口 1**：`WECHAT_APP_ID` / `WECHAT_APP_SECRET` 环境变量为空，无法实际走通微信登录
- **缺口 2**：Profile 页面的"微信快捷登录"按钮指向 `/pages/login/index`，但该页面不存在
- **缺口 3**：`ENABLE_DEV_AUTH=true` 在生产环境必须关闭

### 模拟数据分布

| 位置 | 数据 | 处理 |
|------|------|------|
| SQLite `seed()` | 3 个模拟用户（张师傅/李女士/测试企业）+ 微信管理员绑定 + 4 个演示车型 + 6 个演示订单 + 演示咨询/联系方式/通知 | **删除全部**，仅保留管理员账号 |
| SQLite `seedOperationalDemo()` | 补充 vehicle_count/reserved_count/通知 | **删除** |
| Supabase `seed.ts` | 管理员（环境变量）+ 车型目录 + 轮播图 | **保留**（均为线上真实数据源） |

## 技术方案

| 维度 | 选择 | 理由 |
|------|------|------|
| 微信登录方式 | 小程序原生 `wx.login` → 后端 `jscode2session` | 已实现，只需补配置 |
| 登录页策略 | 不新建独立登录页，改为在 Profile 页直接触发 `Taro.login()` | 当前 `consumer-api.ts` 已自动处理登录流程，Profile 只需调 `ensureConsumerSession()` |
| SQLite 模拟数据清理 | 重写 `seed()` 只保留管理员 + pricing 默认版本 | 线上 Supabase 模式不受影响，SQLite 仅本地开发用 |
| Supabase 模拟数据清理 | 不动 `seed.ts`（管理员来自环境变量，车型/轮播为运营数据） | 无模拟业务数据 |

## 功能模块

### 1. 登录流程修复
- Profile 页"微信快捷登录"按钮改为调 `ensureConsumerSession()` + 刷新用户信息（无需跳转不存在的页面）
- 确保非 WEAPP 环境下 H5 端有合理的降级提示

### 2. 环境变量配置模板
- `.env.example` 中 `WECHAT_APP_ID` / `WECHAT_APP_SECRET` 加注释说明获取方式
- `ENABLE_DEV_AUTH` 加生产环境警告注释

### 3. SQLite seed 清理
- `seed()` 方法：只保留 `admin_users` 插入（管理员账号）+ `pricing_rule_versions` 默认发布版本
- 删除：模拟用户、微信管理员绑定、演示车型、演示订单、演示咨询、联系方式、通知
- `seedOperationalDemo()` 方法：删除模拟通知补充逻辑

### 4. 项目全局检查
- 搜索前端所有硬编码的模拟/演示数据引用
- 确认 `NODE_ENV=production` 时 `ENABLE_DEV_AUTH` 自动失效（已实现：auth.controller.ts 第 13 行检查）
- 确认 `ADMIN_DATA_BACKEND=sqlite` 在生产环境被禁止（已实现：admin-data.service.ts 第 31-33 行）

## 是否有原型设计

否

## 实施步骤

1. **修复登录流程**：Profile 页"微信快捷登录"按钮改为调 `ensureConsumerSession()` 而非跳转不存在的 `/pages/login/index`；确保 H5 端有降级提示 — `src/pages/profile/index.tsx`

2. **清理 SQLite 模拟数据**：重写 `seed()` 仅保留管理员账号 + pricing 默认版本，删除所有演示用户/订单/咨询/通知；精简 `seedOperationalDemo()` — `server/src/admin-data/admin-data.service.ts`

3. **完善环境变量模板**：`.env.example` 中为 `WECHAT_APP_ID`/`WECHAT_APP_SECRET` 添加获取说明注释，`ENABLE_DEV_AUTH` 添加生产环境警告 — `.env.example`

4. **前端模拟数据扫描与清理**：检查 `src/constants/`、`src/data/`、前端页面中是否有硬编码的演示数据引用并清理 — `src/constants/`、`src/data/`

5. **全局验证**：执行 `pnpm validate` + `pnpm build` 确认编译通过，检查日志无异常

## 页面规格

（无新页面或 UI 结构改动，仅修改 Profile 页交互逻辑，不单独写页面规格）
