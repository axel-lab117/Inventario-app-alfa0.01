import { z } from 'zod';

export const ProductConditionSchema = z.enum(['NEW', 'OPEN_BOX_A', 'OPEN_BOX_B', 'OPEN_BOX_C', 'DAMAGED', 'REFURBISHED']);
export type ProductCondition = z.infer<typeof ProductConditionSchema>;

export const ListingStatusSchema = z.enum(['LISTED', 'UNLISTED', 'DRAFT', 'ARCHIVED']);
export type ListingStatus = z.infer<typeof ListingStatusSchema>;

export const ProductSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  categoryId: z.string().uuid().nullable(),
  basePrice: z.number().nonnegative().default(0),
  costPrice: z.number().nonnegative().default(0),
  weightGrams: z.number().int().nonnegative().nullable(),
  dimensionsCm: z.object({ l: z.number(), w: z.number(), h: z.number() }).nullable(),
  barcode: z.string().nullable(),
  gtin: z.string().nullable(),
  images: z.array(z.string().url()).default([]),
  attributes: z.record(z.string(), z.unknown()).default({}),
  isActive: z.boolean().default(true),
  isBundle: z.boolean().default(false),
  bundleItems: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().positive() })).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Product = z.infer<typeof ProductSchema>;

export const ProductVariantSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  tenantId: z.string().uuid(),
  sku: z.string().min(1).max(64),
  barcode: z.string().nullable(),
  condition: ProductConditionSchema.default('NEW'),
  listingStatus: ListingStatusSchema.default('UNLISTED'),
  priceOverride: z.number().nonnegative().nullable(),
  costOverride: z.number().nonnegative().nullable(),
  images: z.array(z.string().url()).default([]),
  attributes: z.record(z.string(), z.unknown()).default({}),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type ProductVariant = z.infer<typeof ProductVariantSchema>;

export const LocationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(128),
  type: z.enum(['ZONE', 'AISLE', 'RACK', 'SHELF', 'BIN', 'VIRTUAL']),
  parentId: z.string().uuid().nullable(),
  capacity: z.number().int().nonnegative().nullable(),
  dimensionsCm: z.object({ l: z.number(), w: z.number(), h: z.number() }).nullable(),
  coordinates: z.object({ x: z.number(), y: z.number(), z: z.number() }).nullable(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Location = z.infer<typeof LocationSchema>;

export const StockLevelSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  variantId: z.string().uuid(),
  locationId: z.string().uuid(),
  quantity: z.number().int().default(0),
  reservedQuantity: z.number().int().default(0),
  availableQuantity: z.number().int().default(0),
  lastCountedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type StockLevel = z.infer<typeof StockLevelSchema>;

export const StockMovementTypeSchema = z.enum([
  'RECEIPT',
  'REMOVE',
  'RETURN',
  'ADJUSTMENT',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'OPEN_BOX_CONVERSION',
  'DAMAGE',
  'CYCLE_COUNT',
  'INITIAL',
]);
export type StockMovementType = z.infer<typeof StockMovementTypeSchema>;

export const StockMovementSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  variantId: z.string().uuid(),
  locationId: z.string().uuid(),
  type: StockMovementTypeSchema,
  quantity: z.number().int(),
  referenceId: z.string().uuid().nullable(),
  referenceType: z.string().nullable(),
  employeeId: z.string().uuid().nullable(),
  reason: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  idempotencyKey: z.string().nullable(),
  createdAt: z.date(),
});
export type StockMovement = z.infer<typeof StockMovementSchema>;

export const BoxCodeSchema = z.object({
  code: z.string(),
  variantId: z.string().uuid(),
  sequence: z.string(),
  locationId: z.string().uuid().nullable(),
  isScanned: z.boolean().default(false),
  scannedAt: z.date().nullable(),
  scannedBy: z.string().uuid().nullable(),
});
export type BoxCode = z.infer<typeof BoxCodeSchema>;

export const InventoryAdjustmentSchema = z.object({
  variantId: z.string().uuid(),
  locationId: z.string().uuid(),
  newQuantity: z.number().int().nonnegative(),
  reason: z.string().min(1),
  employeeId: z.string().uuid(),
});
export type InventoryAdjustment = z.infer<typeof InventoryAdjustmentSchema>;