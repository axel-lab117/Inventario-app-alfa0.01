import { z } from 'zod';

export const ProductConditionEnum = z.enum([
  'NEW',
  'OPEN_BOX_A',
  'OPEN_BOX_B',
  'OPEN_BOX_C',
  'DAMAGED',
  'REFURBISHED',
]);

export const ListingStatusEnum = z.enum([
  'LISTED',
  'UNLISTED',
  'DRAFT',
  'ARCHIVED',
]);

export const LocationTypeEnum = z.enum([
  'ZONE',
  'AISLE',
  'RACK',
  'SHELF',
  'BIN',
  'VIRTUAL',
]);

export const StockMovementTypeEnum = z.enum([
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

export const LocationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),
  code: z.string(),
  name: z.string(),
  type: LocationTypeEnum,
  parentId: z.string().nullable(),
  capacity: z.number().nullable(),
  dimensions: z.record(z.unknown()).nullable(),
  coordinates: z.record(z.unknown()).nullable(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const StockLevelSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),
  variantId: z.string(),
  locationId: z.string(),
  quantity: z.number(),
  reservedQuantity: z.number(),
  availableQuantity: z.number(),
  lastCountedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  location: LocationSchema.optional(),
});

export const ProductVariantSchema = z.object({
  id: z.string().uuid(),
  productId: z.string(),
  tenantId: z.string(),
  sku: z.string(),
  barcode: z.string().nullable(),
  condition: ProductConditionEnum,
  listingStatus: ListingStatusEnum,
  priceOverride: z.number().nullable(),
  costOverride: z.number().nullable(),
  images: z.array(z.string()),
  attributes: z.record(z.unknown()),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  stockLevels: z.array(StockLevelSchema).optional(),
  product: z.object({
    id: z.string().uuid(),
    sku: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    brand: z.string().nullable(),
    model: z.string().nullable(),
    categoryId: z.string().nullable(),
    basePrice: z.number(),
    costPrice: z.number(),
    weightGrams: z.number().nullable(),
    dimensions: z.record(z.unknown()).nullable(),
    barcode: z.string().nullable(),
    gtin: z.string().nullable(),
    images: z.array(z.string()),
    attributes: z.record(z.unknown()),
    isActive: z.boolean(),
    isBundle: z.boolean(),
  }).optional(),
});

export const StockMovementSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),
  variantId: z.string(),
  locationId: z.string(),
  type: StockMovementTypeEnum,
  quantity: z.number(),
  referenceId: z.string().nullable(),
  referenceType: z.string().nullable(),
  employeeId: z.string().nullable(),
  reason: z.string().nullable(),
  metadata: z.record(z.unknown()),
  idempotencyKey: z.string().nullable(),
  createdAt: z.date(),
  variant: ProductVariantSchema.optional(),
  location: LocationSchema.optional(),
  employee: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string(),
  }).nullable().optional(),
});

export const ProductWithStockSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),
  sku: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  categoryId: z.string().nullable(),
  basePrice: z.number(),
  costPrice: z.number(),
  weightGrams: z.number().nullable(),
  dimensions: z.record(z.unknown()).nullable(),
  barcode: z.string().nullable(),
  gtin: z.string().nullable(),
  images: z.array(z.string()),
  attributes: z.record(z.unknown()),
  isActive: z.boolean(),
  isBundle: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  variants: z.array(ProductVariantSchema),
  totalStock: z.number(),
  totalReserved: z.number(),
  totalAvailable: z.number(),
  firstReceiptDate: z.date().nullable(),
  daysInStock: z.number().nullable(),
});

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      totalPages: z.number(),
      hasNext: z.boolean(),
      hasPrev: z.boolean(),
    }),
  });

export const InventoryFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.array(ListingStatusEnum).optional(),
  condition: z.array(ProductConditionEnum).optional(),
  categoryId: z.string().optional(),
  locationId: z.string().optional(),
  lowStock: z.boolean().optional(),
  zeroStock: z.boolean().optional(),
  page: z.number().default(1),
  limit: z.number().default(20),
  sortBy: z.enum(['sku', 'name', 'stock', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const BatchTraceItemSchema = z.object({
  id: z.string().uuid(),
  referenceId: z.string(),
  referenceType: z.string(),
  quantity: z.number(),
  type: StockMovementTypeEnum,
  locationId: z.string(),
  locationCode: z.string(),
  locationName: z.string(),
  createdAt: z.date(),
  employeeName: z.string().nullable(),
});

export const AdjustStockDtoSchema = z.object({
  variantId: z.string().uuid(),
  locationId: z.string().uuid(),
  quantity: z.number().int(),
  type: z.enum(['ADJUSTMENT', 'RECEIPT', 'REMOVE', 'DAMAGE']),
  reason: z.string().optional(),
  referenceId: z.string().optional(),
  referenceType: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export const TransferStockDtoSchema = z.object({
  variantId: z.string().uuid(),
  fromLocationId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  quantity: z.number().int().positive(),
  reason: z.string().optional(),
  referenceId: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export type ProductCondition = z.infer<typeof ProductConditionEnum>;
export type ListingStatus = z.infer<typeof ListingStatusEnum>;
export type LocationType = z.infer<typeof LocationTypeEnum>;
export type StockMovementType = z.infer<typeof StockMovementTypeEnum>;
export type Location = z.infer<typeof LocationSchema>;
export type StockLevel = z.infer<typeof StockLevelSchema>;
export type ProductVariant = z.infer<typeof ProductVariantSchema>;
export type StockMovement = z.infer<typeof StockMovementSchema>;
export type ProductWithStock = z.infer<typeof ProductWithStockSchema>;
export type InventoryFilters = z.infer<typeof InventoryFiltersSchema>;
export type BatchTraceItem = z.infer<typeof BatchTraceItemSchema>;
export type AdjustStockDto = z.infer<typeof AdjustStockDtoSchema>;
export type TransferStockDto = z.infer<typeof TransferStockDtoSchema>;
export type PaginatedResponse<T> = {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};