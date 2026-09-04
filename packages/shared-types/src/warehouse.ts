import { z } from 'zod';

export const WarehouseMapSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1),
  svgContent: z.string(),
  viewBox: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
  scale: z.number().positive().default(1),
  zones: z.array(ZoneSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type WarehouseMap = z.infer<typeof WarehouseMapSchema>;

export const ZoneSchema = z.object({
  id: z.string().uuid(),
  mapId: z.string().uuid(),
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  path: z.string(),
  locations: z.array(z.string().uuid()),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type Zone = z.infer<typeof ZoneSchema>;

export const BinOccupancySchema = z.object({
  locationId: z.string().uuid(),
  usedCapacity: z.number().int().nonnegative(),
  totalCapacity: z.number().int().nonnegative(),
  occupancyPercent: z.number().min(0).max(100),
  skuCount: z.number().int().nonnegative(),
  variantCount: z.number().int().nonnegative(),
});
export type BinOccupancy = z.infer<typeof BinOccupancySchema>;

export const PickingRouteSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  orderIds: z.array(z.string().uuid()),
  locations: z.array(z.object({
    locationId: z.string().uuid(),
    sequence: z.number().int().positive(),
    estimatedTimeSeconds: z.number().int().positive(),
  })),
  totalEstimatedTimeSeconds: z.number().int().positive(),
  totalDistanceMeters: z.number().positive(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  assignedTo: z.string().uuid().nullable(),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  createdAt: z.date(),
});
export type PickingRoute = z.infer<typeof PickingRouteSchema>;

export const WarehouseSettingsSchema = z.object({
  defaultZoneColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#3B82F6'),
  showGrid: z.boolean().default(true),
  gridSize: z.number().int().positive().default(50),
  snapToGrid: z.boolean().default(true),
  defaultBinCapacity: z.number().int().positive().default(100),
  enable3DView: z.boolean().default(false),
});
export type WarehouseSettings = z.infer<typeof WarehouseSettingsSchema>;