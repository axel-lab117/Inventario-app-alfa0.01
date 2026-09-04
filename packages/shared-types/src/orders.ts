import { z } from 'zod';

export const OrderSourceSchema = z.enum(['MERCADOLIBRE', 'FRAVEGA', 'GARBARINO', 'MEGATONE', 'SHOPIFY', 'TIENDANUBE', 'MANUAL', 'API']);
export type OrderSource = z.infer<typeof OrderSourceSchema>;

export const OrderStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'PICKING',
  'PACKING',
  'READY_TO_SHIP',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
  'ON_HOLD',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  source: OrderSourceSchema,
  sourceOrderId: z.string(),
  sourceOrderNumber: z.string().nullable(),
  status: OrderStatusSchema.default('PENDING'),
  customer: CustomerSchema,
  shippingAddress: AddressSchema,
  billingAddress: AddressSchema.nullable(),
  items: z.array(OrderItemSchema),
  subtotal: z.number().nonnegative(),
  tax: z.number().nonnegative().default(0),
  shipping: z.number().nonnegative().default(0),
  discount: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
  currency: z.string().length(3).default('ARS'),
  notes: z.string().nullable(),
  tags: z.array(z.string()).default([]),
  marketplaceData: z.record(z.string(), z.unknown()).default({}),
  pickedAt: z.date().nullable(),
  packedAt: z.date().nullable(),
  shippedAt: z.date().nullable(),
  deliveredAt: z.date().nullable(),
  cancelledAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Order = z.infer<typeof OrderSchema>;

export const CustomerSchema = z.object({
  id: z.string().nullable(),
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().nullable(),
  documentType: z.string().nullable(),
  documentNumber: z.string().nullable(),
  marketplaceId: z.string().nullable(),
});
export type Customer = z.infer<typeof CustomerSchema>;

export const AddressSchema = z.object({
  street: z.string().min(1),
  number: z.string().nullable(),
  floor: z.string().nullable(),
  apartment: z.string().nullable(),
  neighborhood: z.string().nullable(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().length(2).default('AR'),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  instructions: z.string().nullable(),
});
export type Address = z.infer<typeof AddressSchema>;

export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  variantId: z.string().uuid().nullable(),
  sku: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  totalPrice: z.number().nonnegative(),
  condition: z.string().default('NEW'),
  marketplaceItemId: z.string().nullable(),
  pickedQuantity: z.number().int().nonnegative().default(0),
  packedQuantity: z.number().int().nonnegative().default(0),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

export const ReturnStatusSchema = z.enum([
  'REQUESTED',
  'AUTHORIZED',
  'RECEIVED',
  'INSPECTION',
  'RESTOCKED',
  'OPEN_BOX',
  'DAMAGED',
  'DISPOSED',
  'REFUNDED',
  'REJECTED',
]);
export type ReturnStatus = z.infer<typeof ReturnStatusSchema>;

export const ReturnOrderSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  orderId: z.string().uuid(),
  orderItemId: z.string().uuid(),
  source: OrderSourceSchema,
  sourceReturnId: z.string().nullable(),
  status: ReturnStatusSchema.default('REQUESTED'),
  reason: z.string().min(1),
  reasonCategory: z.enum(['WRONG_ITEM', 'DAMAGED', 'NOT_AS_DESCRIBED', 'CHANGED_MIND', 'DEFECTIVE', 'OTHER']),
  quantity: z.number().int().positive(),
  conditionOnReceipt: z.string().nullable(),
  resolution: z.enum(['REFUND', 'REPLACEMENT', 'EXCHANGE', 'STORE_CREDIT']).nullable(),
  refundAmount: z.number().nonnegative().nullable(),
  restockLocationId: z.string().uuid().nullable(),
  inspectedBy: z.string().uuid().nullable(),
  inspectedAt: z.date().nullable(),
  images: z.array(z.string().url()).default([]),
  notes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type ReturnOrder = z.infer<typeof ReturnOrderSchema>;

export const PickingTaskSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  orderId: z.string().uuid(),
  routeId: z.string().uuid().nullable(),
  items: z.array(PickingTaskItemSchema),
  assignedTo: z.string().uuid().nullable(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  priority: z.number().int().default(0),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  createdAt: z.date(),
});
export type PickingTask = z.infer<typeof PickingTaskSchema>;

export const PickingTaskItemSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  orderItemId: z.string().uuid(),
  variantId: z.string().uuid(),
  locationId: z.string().uuid(),
  requiredQuantity: z.number().int().positive(),
  pickedQuantity: z.number().int().nonnegative().default(0),
  sequence: z.number().int().positive(),
  isCompleted: z.boolean().default(false),
});
export type PickingTaskItem = z.infer<typeof PickingTaskItemSchema>;