import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { WarehouseService } from '../warehouse/warehouse.service';
import { RabbitMQService } from '../../config/rabbitmq.service';
import { AuditService } from '../audit/audit.service';
import { OrderStatus, OrderSource } from '@repo/shared-types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private inventory: InventoryService,
    private warehouse: WarehouseService,
    private rabbitmq: RabbitMQService,
    private audit: AuditService,
  ) {}

  async findAll(tenantId: string, params: { page?: number; limit?: number; status?: string; source?: string; search?: string; from?: Date; to?: Date }) {
    const { page = 1, limit = 20, status, source, search, from, to } = params;
    const where: any = { tenantId };

    if (status) where.status = status;
    if (source) where.source = source;
    if (search) {
      where.OR = [
        { sourceOrderNumber: { contains: search, mode: 'insensitive' } },
        { customer: { path: ['name'], string_contains: search } },
        { customer: { path: ['email'], string_contains: search } },
      ];
    }
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: { include: { variant: { include: { product: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { orders, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(tenantId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        returnOrders: { include: { orderItem: true } },
        pickingTasks: { include: { items: { include: { variant: { include: { product: true } }, location: true } } } },
      },
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    return order;
  }

  async createManual(tenantId: string, data: any, userId: string) {
    const subtotal = data.items.reduce((sum: number, item: any) => sum + item.unitPrice * item.quantity, 0);
    const total = subtotal + (data.tax || 0) + (data.shipping || 0) - (data.discount || 0);

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          tenantId,
          source: OrderSource.MANUAL,
          sourceOrderId: `MAN-${Date.now()}`,
          sourceOrderNumber: `MAN-${Date.now()}`,
          status: OrderStatus.PENDING,
          customer: data.customer,
          shippingAddress: data.shippingAddress,
          billingAddress: data.billingAddress,
          items: { create: data.items.map((item: any) => ({ ...item, totalPrice: item.unitPrice * item.quantity })) },
          subtotal,
          tax: data.tax || 0,
          shipping: data.shipping || 0,
          discount: data.discount || 0,
          total,
          currency: data.currency || 'ARS',
          notes: data.notes,
          tags: data.tags || [],
        },
        include: { items: true },
      });

      await this.audit.logOrderEvent({
        tenantId,
        orderId: order.id,
        event: 'CREATED',
        newStatus: OrderStatus.PENDING,
        employeeId: userId,
      });

      return order;
    });
  }

  async updateStatus(tenantId: string, id: string, status: OrderStatus, userId: string) {
    const order = await this.prisma.order.findFirst({ where: { id, tenantId } });
    if (!order) throw new NotFoundException('Orden no encontrada');

    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED, OrderStatus.ON_HOLD],
      [OrderStatus.CONFIRMED]: [OrderStatus.PICKING, OrderStatus.CANCELLED, OrderStatus.ON_HOLD],
      [OrderStatus.PICKING]: [OrderStatus.PACKING, OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.PACKING]: [OrderStatus.READY_TO_SHIP, OrderStatus.PICKING, OrderStatus.CANCELLED],
      [OrderStatus.READY_TO_SHIP]: [OrderStatus.SHIPPED, OrderStatus.PACKING, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.RETURNED],
      [OrderStatus.DELIVERED]: [OrderStatus.RETURNED],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.RETURNED]: [],
      [OrderStatus.ON_HOLD]: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    };

    if (!validTransitions[order.status].includes(status)) {
      throw new BadRequestException(`Transición inválida: ${order.status} -> ${status}`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          status,
          ...(status === OrderStatus.PICKING && { pickedAt: new Date() }),
          ...(status === OrderStatus.PACKING && { packedAt: new Date() }),
          ...(status === OrderStatus.SHIPPED && { shippedAt: new Date() }),
          ...(status === OrderStatus.DELIVERED && { deliveredAt: new Date() }),
          ...(status === OrderStatus.CANCELLED && { cancelledAt: new Date() }),
        },
      });

      await this.audit.logOrderEvent({
        tenantId,
        orderId: id,
        event: 'STATUS_CHANGE',
        previousStatus: order.status,
        newStatus: status,
        employeeId: userId,
      });

      await this.rabbitmq.publishEvent('order.status_changed', {
        tenantId,
        orderId: id,
        previousStatus: order.status,
        newStatus: status,
        timestamp: Date.now(),
      });

      return updated;
    });
  }

  async createPickingTask(tenantId: string, orderId: string, userId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, tenantId } });
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (order.status !== OrderStatus.CONFIRMED && order.status !== OrderStatus.PICKING) {
      throw new BadRequestException('Orden debe estar confirmada o en picking');
    }

    const items = order.items.filter(i => i.pickedQuantity < i.quantity);
    if (items.length === 0) throw new BadRequestException('No hay items por pickear');

    const route = await this.warehouse.getPickingRoute(tenantId, [orderId]);

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.pickingTask.create({
        data: {
          tenantId,
          orderId,
          routeId: route.id,
          assignedTo: userId,
          status: 'IN_PROGRESS',
          priority: 0,
          startedAt: new Date(),
          items: {
            create: items.map((item, index) => {
              const bestStock = item.variant?.stockLevels?.sort((a: any, b: any) => b.availableQuantity - a.availableQuantity)[0];
              return {
                orderItemId: item.id,
                variantId: item.variantId,
                locationId: bestStock?.locationId || '',
                requiredQuantity: item.quantity - item.pickedQuantity,
                sequence: index + 1,
              };
            }),
          },
        },
        include: { items: { include: { variant: { include: { product: true } }, location: true } } },
      });

      await tx.order.update({ where: { id: orderId }, data: { status: OrderStatus.PICKING, pickedAt: new Date() } });

      return task;
    });
  }

  async getPickingTasks(tenantId: string, params: { status?: string; assignedTo?: string; page?: number; limit?: number }) {
    const { status, assignedTo, page = 1, limit = 20 } = params;
    const where: any = { tenantId };
    if (status) where.status = status;
    if (assignedTo) where.assignedTo = assignedTo;

    const [tasks, total] = await Promise.all([
      this.prisma.pickingTask.findMany({
        where,
        include: { items: { include: { variant: { include: { product: true } }, location: true } }, order: true },
        orderBy: { priority: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.pickingTask.count({ where }),
    ]);

    return { tasks, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async completePickingTask(tenantId: string, taskId: string, items: { taskItemId: string; pickedQuantity: number }[]) {
    return this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const taskItem = await tx.pickingTaskItem.findFirst({ where: { id: item.taskItemId, taskId } });
        if (!taskItem) continue;

        await tx.pickingTaskItem.update({
          where: { id: item.taskItemId },
          data: { pickedQuantity: item.pickedQuantity, isCompleted: item.pickedQuantity >= taskItem.requiredQuantity },
        });

        await tx.orderItem.update({
          where: { id: taskItem.orderItemId },
          data: { pickedQuantity: { increment: item.pickedQuantity } },
        });

        await this.inventory.reserveStock(tenantId, taskItem.variantId, taskItem.locationId, item.pickedQuantity, taskItem.orderItemId, 'ORDER_ITEM');
      }

      const allCompleted = await tx.pickingTaskItem.findFirst({ where: { taskId, isCompleted: false } });
      if (!allCompleted) {
        await tx.pickingTask.update({ where: { id: taskId }, data: { status: 'COMPLETED', completedAt: new Date() } });
        await tx.order.update({ where: { id: (await tx.pickingTask.findUnique({ where: { id: taskId } })).orderId }, data: { status: OrderStatus.PACKING } });
      }
    });
  }

  async packOrder(tenantId: string, orderId: string, data: { items: { orderItemId: string; packedQuantity: number; trackingNumber?: string }[] }) {
    return this.prisma.$transaction(async (tx) => {
      for (const item of data.items) {
        await tx.orderItem.update({
          where: { id: item.orderItemId },
          data: { packedQuantity: { increment: item.packedQuantity } },
        });
      }

      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      const allPacked = order.items.every(i => i.packedQuantity >= i.quantity);

      if (allPacked) {
        await tx.order.update({ where: { id: orderId }, data: { status: OrderStatus.READY_TO_SHIP, packedAt: new Date() } });
      }

      return { success: true, allPacked };
    });
  }

  async shipOrder(tenantId: string, orderId: string, trackingNumber: string, carrier: string) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId, tenantId },
        data: { status: OrderStatus.SHIPPED, shippedAt: new Date(), marketplaceData: { trackingNumber, carrier } },
      });

      await this.audit.logOrderEvent({ tenantId, orderId, event: 'SHIPPED', newStatus: OrderStatus.SHIPPED, metadata: { trackingNumber, carrier } });
      await this.rabbitmq.publishEvent('order.shipped', { tenantId, orderId, trackingNumber, carrier, timestamp: Date.now() });

      return updated;
    });
  }

  async getOrderStats(tenantId: string) {
    const [byStatus, recent, avgProcessing] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], where: { tenantId }, _count: { status: true } }),
      this.prisma.order.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, sourceOrderNumber: true, status: true, total: true, createdAt: true } }),
      this.prisma.$queryRawUnsafe`
        SELECT AVG(EXTRACT(EPOCH FROM ("shippedAt" - "createdAt"))/3600) as avg_hours
        FROM "orders" WHERE "tenantId" = ${tenantId} AND "shippedAt" IS NOT NULL
      `,
    ]);

    return {
      byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count.status }), {}),
      recent,
      avgProcessingHours: (avgProcessing as any)[0]?.avg_hours || 0,
    };
  }
}