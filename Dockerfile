# 校园校服订购尺码试穿与售后换码平台
# 多阶段构建：依赖 → 构建 → 运行（Next.js standalone）

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 生产依赖（standalone 追踪未覆盖的运行时外部包，如 mysql2/bcryptjs/jose，与 standalone 合并后保证可解析）
COPY --from=deps /app/node_modules ./node_modules
# standalone 产物 + 静态资源 + 数据库初始化脚本
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/lib/schema.sql ./src/lib/schema.sql
COPY --from=builder /app/src/lib/seed.sql ./src/lib/seed.sql

EXPOSE 3000
# 启动时先初始化数据库（建表 + 空库种子数据），再启动应用
CMD ["sh", "-c", "node scripts/init-db.js && node server.js"]
