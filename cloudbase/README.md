# 唐小识 - CloudBase 部署手册

环境 ID:`xdne-d9gogycgp878d9f73`
地域:ap-shanghai(上海)
本文档列出 **你在 CloudBase 控制台手动操作的清单**。代码仓库里的变更已经做完。

---

## 0. 一次性前置(每个环境只做一次)

| # | 操作 | 在哪做 |
|---|---|---|
| 0.1 | 确认 CloudBase 环境已创建(环境 ID 见上) | CloudBase 控制台 |
| 0.2 | 开通 **静态托管** 服务 | 控制台 → 静态网站托管 → 开通 |
| 0.3 | 开通 **云托管** 服务(若尚未开通) | 控制台 → 云托管 → 开通 |
| 0.4 | 准备一个**镜像仓库**(腾讯云 TCR / CloudBase 自带均可) | 控制台 |

---

## 1. 部署 Node 后端 → CloudBase 云托管

### 1.1 构建镜像

在项目根目录:

```bash
docker build -t tangshi-server:latest .
```

镜像大小应控制在 200MB 以内(node:20-alpine + 仅 prod 依赖 + 编译后 JS)。

### 1.2 推送到镜像仓库

腾讯云 TCR 推送示例(替换占位符):

```bash
# 登录
docker login ccr.ccs.tencentyun.com --username <你的 TCR 用户名>

# 打 tag
docker tag tangshi-server:latest ccr.ccs.tencentyun.com/<命名空间>/tangshi-server:latest

# 推送
docker push ccr.ccs.tencentyun.com/<命名空间>/tangshi-server:latest
```

### 1.3 在 CloudBase 云托管创建服务

控制台 → 云托管 → 新建服务:

| 配置项 | 值 |
|---|---|
| 服务名 | `tangshi-api` |
| 地域 | ap-shanghai |
| 镜像 | 选上面推送的镜像 |
| 端口 | `3000` |
| CPU / 内存 | 0.5 vCPU / 512 MB 起(可后续调) |
| 实例数 | 1(可后续调) |
| 启动命令 | **留空**(已通过 Dockerfile ENTRYPOINT 设置) |
| 健康检查路径 | `/api/health` |
| 健康检查方式 | HTTP GET |
| 健康检查超时 | 5 秒 |
| 启动等待时间 | 15 秒 |

### 1.4 配置环境变量

控制台 → 服务详情 → 环境变量(勾选"运行环境"):

```ini
NODE_ENV=production
PORT=3000
ENABLE_DEV_AUTH=false
ADMIN_ALLOWED_ORIGINS=https://<静态托管域名,见第 2 步>

COZE_SUPABASE_URL=<同 .env.local>
COZE_SUPABASE_ANON_KEY=<同 .env.local>
COZE_SUPABASE_SERVICE_ROLE_KEY=<同 .env.local>

WECHAT_APP_ID=<同 .env.local>
WECHAT_APP_SECRET=<同 .env.local>

TOS_ACCESS_KEY=<同 .env.local>
TOS_SECRET_KEY=<同 .env.local>
TOS_REGION=cn-beijing
TOS_ENDPOINT=tos-cn-beijing.volces.com
TOS_BUCKET=<同 .env.local>
TOS_PUBLIC_BASE_URL=<同 .env.local>

LOCATION_APIKEY=<同 .env.local>
```

> **不要把任何密钥写进仓库代码或本 README 的真实值。**

### 1.5 触发部署

控制台 → 服务详情 → 版本管理 → 发布新版本 → 选刚才推送的镜像 → 流量 100%。

### 1.6 验证

```bash
# 健康检查
curl https://<云托管域名>/api/health
# 应返回 {"status":"success","data":"<ISO 时间>"}

# 业务接口(无需鉴权)
curl https://<云托管域名>/api/content/contact
# 应返回 { phone, wechat, email, workTime, extraText } 或 {} 空对象(首次启动会 seed 默认值)
```

---

## 2. 部署管理员端 → CloudBase 静态托管

### 2.1 重新构建 admin(需要后端 URL)

```bash
# 把 admin-web/.env.production.example 复制为 .env.production 并填值
cp admin-web/.env.production.example admin-web/.env.production
# 编辑,填上 1.6 拿到的云托管域名(末尾不带 /api)
# VITE_API_BASE_URL=https://tangshi-api-xxxxxx.ap-shanghai.app.tcloudbase.com

# 编译
pnpm build:admin
```

产物在 `server/dist/public/admin/`(只这个目录),约 800 KB。

### 2.2 上传

**方式 A(控制台上传,推荐)**

控制台 → 静态网站托管 → 文件管理 → 进入 `/` 目录:

- 上传 `server/dist/public/admin/index.html` 到根目录
- 上传 `server/dist/public/admin/assets/` 整个目录

**方式 B(CLI 批量上传)**

```bash
# 安装 CloudBase CLI
npm i -g @cloudbase/cli
tcb login

# 批量上传(目录会原样映射到静态托管根)
tcb storage upload -e xdne-d9gogycgp878d9f73 \
  server/dist/public/admin /
```

### 2.3 配置 SPA fallback(路由刷新不 404)

控制台 → 静态网站托管 → 设置 → 错误页配置:

- 404 页面:填 `index.html`(让前端路由接管)

### 2.4 验证

浏览器打开静态托管给的域名(类似 `https://xxx.tcloudbaseapp.com`),应直接看到登录页。

---

## 3. 配置小程序端

### 3.1 重新构建小程序

```bash
# 设置后端域名为环境变量,Taro 编译时会注入到 Network.request
export PROJECT_DOMAIN=https://<云托管域名>
# 注意:不要带末尾斜杠,Network.request 会拼 /api/xxx

pnpm build:weapp
```

产物在 `dist/`。

### 3.2 微信公众平台配置 request 合法域名

登录 https://mp.weixin.qq.com → 开发管理 → 开发设置 → 服务器域名:

- request 合法域名:添加 `https://<云托管域名>`
- uploadFile 合法域名:同上
- downloadFile 合法域名:同上

### 3.3 微信开发者工具上传

见顶层 `INTEGRATION.md` 的"微信开发者工具操作步骤"章节。

---

## 4. 部署顺序(强烈建议)

```
1. 先部署后端 → 拿到 API URL
2. 再部署管理员端(构建时填 VITE_API_BASE_URL = API URL)
3. 再配置小程序端(构建时 PROJECT_DOMAIN = API URL)
4. 最后在微信开发者工具上传小程序
```

---

## 5. 回滚 / 监控

| 场景 | 操作 |
|---|---|
| 后端回滚到上一个版本 | 云托管 → 服务 → 版本管理 → 切流量 |
| 查看后端日志 | 云托管 → 服务 → 日志 |
| 静态托管回滚 | 控制台无版本管理,需重新上传覆盖;**生产前先备份当前文件** |
| 修改环境变量 | 云托管 → 服务 → 环境变量 → 修改后**需要重新部署**才生效 |

---

## 6. 常见问题

**Q: 健康检查一直失败 / 容器反复重启?**
A: 进入日志,常见原因:
- `ENABLE_DEV_AUTH=false` 但 .env 没传 → 登录失败,Supabase 初始化失败
- `ADMIN_ALLOWED_ORIGINS` 没填 → CORS 报错(但这不影响健康检查)
- `COZE_SUPABASE_URL` 拼错 → 启动时 seed 抛错

**Q: 静态托管打开 404?**
A: 大概率是 `index.html` 没传到根目录。检查:
- 控制台 → 文件管理,根目录下应该能看到 `index.html` 和 `assets/`
- 错误页配置是否设为 `index.html`

**Q: 小程序请求报 "不在合法域名列表"?**
A: 微信公众平台 → 开发设置 → 服务器域名 没加,或加的不是 https,或域名拼错。

**Q: 管理员端打 API 报 CORS?**
A: 后端 `ADMIN_ALLOWED_ORIGINS` 没包含静态托管域名。注意是完整 origin(带协议),逗号分隔。