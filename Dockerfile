# 唐小识无人运力配送小程序 - 后端 NestJS 服务
# 适用于腾讯云 CloudBase 云托管(也兼容任何 node:20+ 容器平台)
#
# 构建:  docker build -t tangshi-server .
# 运行:  docker run -p 3000:3000 --env-file server/.env.production tangshi-server
#
# CloudBase 云托管上传: 用 tcb CLI 或控制台镜像仓库推送
#   tcb fn deploy container tangshi-server --code-path .

# ─── 依赖层:先装 prod deps 拿到缓存层 ───
FROM node:20-alpine AS deps
WORKDIR /app
# 关键文件先复制,pnpm install 命中率更高
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* .npmrc ./
COPY server/package.json ./server/package.json
COPY admin-web/package.json ./admin-web/package.json
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate \
 && pnpm install --frozen-lockfile --prod --filter server...

# ─── 构建层:nest build 把 TS 编成 JS ───
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* .npmrc ./
COPY server/package.json ./server/package.json
COPY admin-web/package.json ./admin-web/package.json
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate \
 && pnpm install --frozen-lockfile --filter server... \
 && pnpm --filter server build

# ─── 运行层:只带 prod 依赖和编译产物 ───
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    NPM_CONFIG_LOGLEVEL=warn

# 系统依赖:wget 用于健康检查
RUN apk add --no-cache wget tini

# 复制编译产物
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/package.json

# 复制生产依赖
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY --from=deps /app/package.json ./package.json

WORKDIR /app/server

# 健康检查(CloudBase 云托管的 liveness probe 会自动覆盖,这里作为容器运行时自检)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:${PORT}/api/health || exit 1

EXPOSE 3000

# tini 处理 PID 1 信号,NestJS 优雅退出
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]