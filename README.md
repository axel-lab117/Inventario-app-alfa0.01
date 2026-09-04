# WMS - Warehouse Management System

Sistema de gestión de inventario multi-tenant para sincronización con marketplaces (MercadoLibre, Frávega, Garbarino, Megatone) y operaciones de almacén.

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                      Monorepo (pnpm + Turborepo)            │
├─────────────────┬─────────────────┬─────────────────────────┤
│   apps/         │  packages/      │  infra/                 │
├─────────────────┼─────────────────┼─────────────────────────┤
│ dashboard/      │ config/         │ docker-compose.yml      │
│  (Next.js 14)   │  (ESLint, TS,   │  PostgreSQL             │
│  Employer/      │   Tailwind,     │  TimescaleDB            │
│  Supervisor)    │   Prettier)     │  Redis                  │
├─────────────────┼─────────────────┼  RabbitMQ               │
│ picker-pwa/     │ shared-types/   │  MinIO                  │
│  (Next.js +     │  (Zod schemas)  │                         │
│   Capacitor)    │ db/             │                         │
│  Employee       │  (Prisma)       │                         │
├─────────────────┼─────────────────┤                         │
│ sync-workers/   │ ui/             │                         │
│  (NestJS)       │  (Components)   │                         │
│  API + Workers  │ marketplace-    │                         │
│  Webhooks       │  adapters/      │                         │
└─────────────────┴─────────────────┴─────────────────────────┘
```

## Requisitos

- Node.js 20+
- pnpm 8.10+
- Docker & Docker Compose
- PostgreSQL 16 + TimescaleDB
- Redis 7
- RabbitMQ 3.13

## Inicio Rápido

```bash
# 1. Clonar e instalar
git clone <repo>
cd wms-monorepo
pnpm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 3. Levantar infraestructura
docker-compose up -d postgres timescaledb redis rabbitmq minio

# 4. Generar cliente Prisma y migrar
pnpm db:generate
pnpm db:migrate

# 5. Seed de datos demo
pnpm --filter @repo/db db:seed

# 6. Desarrollo (terminales separadas)
pnpm dev                    # Todos los apps
# o individualmente:
pnpm --filter @wms/sync-workers start:dev  # API en :4000
pnpm --filter @wms/dashboard dev           # Dashboard en :3000
pnpm --filter @wms/picker-pwa dev          # PWA en :3001
```

## Credenciales Demo (después del seed)

| Rol | Email | Password |
|-----|-------|----------|
| Owner | owner@demo.com | password123 |
| Supervisor | supervisor@demo.com | password123 |
| Employee | employee@demo.com | password123 |

## URLs Desarrollo

| Servicio | URL |
|----------|-----|
| API (Sync Workers) | http://localhost:4000 |
| Swagger Docs | http://localhost:4000/docs |
| Dashboard | http://localhost:3000 |
| Picker PWA | http://localhost:3001 |
| RabbitMQ Management | http://localhost:15672 (wms/wms_secret) |
| MinIO Console | http://localhost:9001 (wms/wms_secret) |

## Scripts Principales

```bash
# Raíz
pnpm dev              # Dev all apps
pnpm build            # Build all apps
pnpm lint             # Lint all
pnpm typecheck        # TypeScript check all
pnpm db:generate      # Prisma generate
pnpm db:migrate       # Prisma migrate dev
pnpm db:seed          # Seed database
pnpm clean            # Clean all node_modules

# Sync Workers
pnpm --filter @wms/sync-workers start:dev
pnpm --filter @wms/sync-workers test
pnpm --filter @wms/sync-workers prisma:studio

# Dashboard
pnpm --filter @wms/dashboard dev
pnpm --filter @wms/dashboard build

# Picker PWA
pnpm --filter @wms/picker-pwa dev
pnpm --filter @wms/picker-pwa cap:sync
pnpm --filter @wms/picker-pwa cap:open:android
```

## Módulos Backend (Sync Workers)

| Módulo | Endpoints | Descripción |
|--------|-----------|-------------|
| Auth | `/api/v1/auth/*` | Login, register, refresh, me |
| Tenants | `/api/v1/tenants/*` | Config, branding, users |
| Products | `/api/v1/products/*` | CRUD, variants, import ML |
| Inventory | `/api/v1/inventory/*` | Stock, movements, adjustments, scanner |
| Warehouse | `/api/v1/warehouse/*` | Maps, locations, occupancy, routes |
| Orders | `/api/v1/orders/*` | Orders, picking, packing, shipping |
| Returns | `/api/v1/returns/*` | RMA flow, inspection, resolution |
| Marketplaces | `/api/v1/marketplaces/*` | Connections, sync, linking |
| Sync | `/api/v1/sync/*` | Manual sync, logs |
| Webhooks | `/api/v1/webhooks/*` | ML, Frávega, Garbarino, Megatone |
| Audit | `/api/v1/audit/*` | Stock/Order/Sync history |

## Flujo Scanner Empleado (PWA)

1. **Login** → Selecciona tenant → Dashboard picker
2. **Escanear** → Cámara abre → Lee código caja (`BOX-SKU-SEQ`)
3. **Procesar** → `POST /inventory/scan/remove` (idempotency key)
4. **Offline** → Guarda en IndexedDB → Background Sync al volver online
5. **Confirmación** → Vibración + sonido + toast

## Multi-tenancy

- Row-level security via Prisma middleware
- `tenantId` inyectado automáticamente en todas las queries
- Headers `x-tenant-id` o `x-tenant-slug` para API calls
- Aislamiento completo de datos por tenant

## Sincronización Marketplaces

- **MercadoLibre**: Webhooks (orders, items, stock) + Polling 15min
- **Frávega/Garbarino/Megatone**: Adaptadores custom (por implementar)
- **Patrón Adapter**: Cada marketplace implementa `MarketplaceAdapter`
- **Idempotency**: Claves únicas por evento webhook
- **Conflict Resolution**: Last-write-wins con auditoría en TimescaleDB

## Despliegue Producción

```bash
# Build imágenes
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Deploy stack
docker stack deploy -c docker-compose.prod.yml wms

# Migraciones
docker run --rm -e DATABASE_URL=... wms-migrate

# Health checks
curl http://api:4000/api/v1/health
```

## Estructura de Base de Datos (Prisma)

Principales modelos:
- `Tenant` + `User` + `ApiKey`
- `Product` + `ProductVariant` (conditions: NEW, OPEN_BOX_A/B/C, DAMAGED)
- `Location` (jerárquico: ZONE → AISLE → RACK → SHELF → BIN)
- `StockLevel` + `StockMovement` (auditoría completa)
- `Order` + `OrderItem` + `PickingTask` + `PickingTaskItem`
- `ReturnOrder` (RMA workflow)
- `MarketplaceConnection` + `MarketplaceProduct` + `MarketplaceOrder`
- `WarehouseMap` + `Zone` (SVG editor)
- `SyncLog` + `WebhookEvent` (idempotency)

## Tech Stack

| Capa | Tecnología |
|------|------------|
| Runtime | Node.js 20, TypeScript 5 |
| API | NestJS 10, Fastify |
| ORM | Prisma 5 (PostgreSQL) |
| Cache/Queue | Redis 7, RabbitMQ 3.13 |
| Audit DB | TimescaleDB |
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Mobile | Capacitor 5, ML Kit Barcode |
| State | Zustand, React Hook Form, Zod |
| Monorepo | pnpm 8, Turborepo |

## Licencia

Proprietary - WMS Team