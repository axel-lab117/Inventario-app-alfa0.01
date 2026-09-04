FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@8.10.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/sync-workers/package.json ./apps/sync-workers/
RUN pnpm install --frozen-lockfile --filter @wms/sync-workers --filter @repo/db --filter @repo/shared-types --filter @repo/marketplace-adapters --filter @repo/config --filter @repo/ui

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN pnpm --filter @wms/sync-workers run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/sync-workers/dist ./dist
COPY --from=builder /app/apps/sync-workers/package.json ./package.json
COPY --from=builder /app/apps/sync-workers/prisma ./prisma

EXPOSE 4000
CMD ["node", "dist/main.js"]