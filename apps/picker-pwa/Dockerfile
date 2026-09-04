FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@8.10.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/picker-pwa/package.json ./apps/picker-pwa/
RUN pnpm install --frozen-lockfile --filter @wms/picker-pwa --filter @repo/shared-types --filter @repo/ui --filter @repo/config --filter @repo/db

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN pnpm --filter @wms/picker-pwa run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/picker-pwa/.next/standalone ./
COPY --from=builder /app/apps/picker-pwa/.next/static ./.next/static
COPY --from=builder /app/apps/picker-pwa/public ./public

EXPOSE 3001
CMD ["node", "server.js"]