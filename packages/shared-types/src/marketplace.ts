import { z } from 'zod';

export const MarketplaceSchema = z.enum(['MERCADOLIBRE', 'FRAVEGA', 'GARBARINO', 'MEGATONE', 'SHOPIFY', 'TIENDANUBE', 'AMAZON']);
export type Marketplace = z.infer<typeof MarketplaceSchema>;

export const MarketplaceConnectionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  marketplace: MarketplaceSchema,
  name: z.string().min(1),
  credentials: z.record(z.string(), z.string()),
  settings: MarketplaceSettingsSchema,
  status: z.enum(['ACTIVE', 'INACTIVE', 'ERROR', 'SYNCING']),
  lastSyncAt: z.date().nullable(),
  lastError: z.string().nullable(),
  syncEnabled: z.boolean().default(true),
  syncIntervalMinutes: z.number().int().positive().default(15),
  webhookUrl: z.string().url().nullable(),
  webhookSecret: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type MarketplaceConnection = z.infer<typeof MarketplaceConnectionSchema>;

export const MarketplaceSettingsSchema = z.object({
  autoImportOrders: z.boolean().default(true),
  autoSyncStock: z.boolean().default(true),
  autoSyncPrice: z.boolean().default(false),
  defaultCondition: z.string().default('NEW'),
  defaultListingStatus: z.string().default('LISTED'),
  skuMapping: z.record(z.string(), z.string()).default({}),
  warehouseMapping: z.record(z.string(), z.string()).default({}),
  ignoredOrderStatuses: z.array(z.string()).default([]),
  customFields: z.record(z.string(), z.unknown()).default({}),
});
export type MarketplaceSettings = z.infer<typeof MarketplaceSettingsSchema>;

export const MarketplaceProductSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  connectionId: z.string().uuid(),
  marketplaceProductId: z.string(),
  marketplaceSku: z.string(),
  localVariantId: z.string().uuid().nullable(),
  title: z.string(),
  price: z.number().nonnegative(),
  stock: z.number().int().nonnegative(),
  status: z.string(),
  permalink: z.string().url().nullable(),
  images: z.array(z.string().url()).default([]),
  attributes: z.record(z.string(), z.unknown()).default({}),
  lastSyncedAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type MarketplaceProduct = z.infer<typeof MarketplaceProductSchema>;

export const MarketplaceOrderSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  connectionId: z.string().uuid(),
  marketplaceOrderId: z.string(),
  marketplaceOrderNumber: z.string().nullable(),
  status: z.string(),
  buyer: z.record(z.string(), z.unknown()),
  items: z.array(MarketplaceOrderItemSchema),
  total: z.number().nonnegative(),
  currency: z.string().length(3),
  shipping: z.record(z.string(), z.unknown()).nullable(),
  payment: z.record(z.string(), z.unknown()).nullable(),
  dates: z.record(z.string(), z.unknown()).default({}),
  rawData: z.record(z.string(), z.unknown()).default({}),
  importedAt: z.date().nullable(),
  createdAt: z.date(),
});
export type MarketplaceOrder = z.infer<typeof MarketplaceOrderSchema>;

export const MarketplaceOrderItemSchema = z.object({
  marketplaceItemId: z.string(),
  sku: z.string(),
  title: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  totalPrice: z.number().nonnegative(),
  variantId: z.string().nullable(),
  condition: z.string().nullable(),
});
export type MarketplaceOrderItem = z.infer<typeof MarketplaceOrderItemSchema>;

export const SyncLogSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  connectionId: z.string().uuid(),
  type: z.enum(['STOCK', 'PRICE', 'ORDERS', 'PRODUCTS', 'FULL']),
  status: z.enum(['STARTED', 'SUCCESS', 'PARTIAL', 'FAILED']),
  recordsProcessed: z.number().int().nonnegative().default(0),
  recordsSucceeded: z.number().int().nonnegative().default(0),
  recordsFailed: z.number().int().nonnegative().default(0),
  errors: z.array(z.object({
    code: z.string(),
    message: z.string(),
    recordId: z.string().nullable(),
  })).default([]),
  startedAt: z.date(),
  completedAt: z.date().nullable(),
});
export type SyncLog = z.infer<typeof SyncLogSchema>;

export const WebhookEventSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  connectionId: z.string().uuid(),
  marketplace: MarketplaceSchema,
  eventType: z.string(),
  resourceType: z.string(),
  resourceId: z.string(),
  payload: z.record(z.string(), z.unknown()),
  headers: z.record(z.string(), z.string()),
  processed: z.boolean().default(false),
  processedAt: z.date().nullable(),
  error: z.string().nullable(),
  idempotencyKey: z.string(),
  receivedAt: z.date(),
});
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

export interface MarketplaceAdapter {
  readonly marketplace: Marketplace;
  authenticate(credentials: Record<string, string>): Promise<AuthResult>;
  testConnection(credentials: Record<string, string>): Promise<boolean>;
  fetchProducts(params: FetchProductsParams): Promise<MarketplaceProductResult[]>;
  fetchOrders(params: FetchOrdersParams): Promise<MarketplaceOrderResult[]>;
  fetchOrderDetails(orderId: string): Promise<MarketplaceOrderResult>;
  updateStock(productId: string, stock: number): Promise<UpdateResult>;
  updatePrice(productId: string, price: number): Promise<UpdateResult>;
  createProduct(product: CreateProductInput): Promise<CreateProductResult>;
  updateProduct(productId: string, product: UpdateProductInput): Promise<UpdateResult>;
  getWebhookSignature(payload: string, secret: string): string;
  verifyWebhook(payload: string, signature: string, secret: string): boolean;
}

export interface AuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}

export interface FetchProductsParams {
  limit?: number;
  offset?: number;
  status?: string;
  updatedSince?: Date;
}

export interface MarketplaceProductResult {
  id: string;
  sku: string;
  title: string;
  price: number;
  stock: number;
  status: string;
  permalink?: string;
  images: string[];
  attributes: Record<string, unknown>;
}

export interface FetchOrdersParams {
  limit?: number;
  offset?: number;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface MarketplaceOrderResult {
  id: string;
  orderNumber?: string;
  status: string;
  buyer: Record<string, unknown>;
  items: MarketplaceOrderItemResult[];
  total: number;
  currency: string;
  shipping?: Record<string, unknown>;
  payment?: Record<string, unknown>;
  dates: Record<string, unknown>;
  rawData: Record<string, unknown>;
}

export interface MarketplaceOrderItemResult {
  id: string;
  sku: string;
  title: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface UpdateResult {
  success: boolean;
  error?: string;
}

export interface CreateProductInput {
  sku: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  images: string[];
  attributes: Record<string, unknown>;
  categoryId?: string;
}

export interface CreateProductResult {
  success: boolean;
  productId?: string;
  error?: string;
}

export interface UpdateProductInput {
  title?: string;
  description?: string;
  price?: number;
  stock?: number;
  images?: string[];
  attributes?: Record<string, unknown>;
  status?: string;
}