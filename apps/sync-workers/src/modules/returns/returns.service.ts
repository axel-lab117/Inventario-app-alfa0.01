import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../audit/audit.service';
import { ReturnStatus, ProductCondition } from '@repo/shared-types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ReturnsService {
  constructor(private prisma: PrismaService, private inventory: InventoryService, private audit: AuditService) {}

  async findAll(tenantId: string, params: { page?: number; limit?: number; status?: string; source?: string; from?: Date; to?: Date }) {
    const { page = 1, limit = 20, status, source, from, to } = params;
    const where: any = { tenantId };

    if (status) where.status = status;
    if (source) where.source = source;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }

    const [returns, total] = await Promise.all([
      this.prisma.returnOrder.findMany({
        where,
        include: { order: { select: { sourceOrderNumber: true } }, orderItem: { include: { variant: { include: { product: true } } } }, restockLocation: true, inspectedBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.returnOrder.count({ where }),
    ]);

    return { returns, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(tenantId: string, id: string) {
    const ret = await this.prisma.returnOrder.findFirst({
      where: { id, tenantId },
      include: { order: true, orderItem: { include: { variant: { include: { product: true } } } }, restockLocation: true, inspectedBy: { select: { id: true, name: true } } },
    });
    if (!ret) throw new NotFoundException('Devolución no encontrada');
    return ret;
  }

  async createFromMarketplace(tenantId: string, data: { orderId: string; orderItemId: string; source: string; sourceReturnId: string; reason: string; reasonCategory: string; quantity: number }) {
    return this.prisma.returnOrder.create({
      data: {
        tenantId,
        orderId: data.orderId,
        orderItemId: data.orderItemId,
        source: data.source as any,
        sourceReturnId: data.sourceReturnId,
        status: ReturnStatus.REQUESTED,
        reason: data.reason,
        reasonCategory: data.reasonCategory,
        quantity: data.quantity,
      },
    });
  }

  async authorize(tenantId: string, id: string, userId: string) {
    const ret = await this.prisma.returnOrder.findFirst({ where: { id, tenantId } });
    if (!ret) throw new NotFoundException('Devolución no encontrada');
    if (ret.status !== ReturnStatus.REQUESTED) throw new BadRequestException('Solo se pueden autorizar devoluciones solicitadas');

    return this.prisma.returnOrder.update({
      where: { id },
      data: { status: ReturnStatus.AUTHORIZED },
    });
  }

  async receive(tenantId: string, id: string, data: { conditionOnReceipt: string; images: string[]; restockLocationId: string }, userId: string) {
    const ret = await this.prisma.returnOrder.findFirst({ where: { id, tenantId }, include: { orderItem: true } });
    if (!ret) throw new NotFoundException('Devolución no encontrada');
    if (ret.status !== ReturnStatus.AUTHORIZED) throw new BadRequestException('Devolución debe estar autorizada');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.returnOrder.update({
        where: { id },
        data: {
          status: ReturnStatus.INSPECTION,
          conditionOnReceipt: data.conditionOnReceipt,
          images: data.images,
          restockLocationId: data.restockLocationId,
        },
      });

      await this.audit.logOrderEvent({
        tenantId,
        orderId: ret.orderId,
        event: 'RETURN_RECEIVED',
        newStatus: ReturnStatus.INSPECTION,
        employeeId: userId,
        metadata: { returnId: id, condition: data.conditionOnReceipt },
      });

      return updated;
    });
  }

  async inspect(tenantId: string, id: string, data: { resolution: 'RESTOCK' | 'OPEN_BOX' | 'DAMAGE' | 'DISPOSE'; targetCondition?: ProductCondition; refundAmount?: number }, userId: string) {
    const ret = await this.prisma.returnOrder.findFirst({ where: { id, tenantId }, include: { orderItem: { include: { variant: true } } } });
    if (!ret) throw new NotFoundException('Devolución no encontrada');
    if (ret.status !== ReturnStatus.INSPECTION) throw new BadRequestException('Devolución debe estar en inspección');

    return this.prisma.$transaction(async (tx) => {
      let newStatus: ReturnStatus;
      let targetVariantId = ret.orderItem.variantId;

      switch (data.resolution) {
        case 'RESTOCK':
          newStatus = ReturnStatus.RESTOCKED;
          break;
        case 'OPEN_BOX':
          if (!data.targetCondition || !['OPEN_BOX_A', 'OPEN_BOX_B', 'OPEN_BOX_C'].includes(data.targetCondition)) {
            throw new BadRequestException('Debe especificar condición Open Box válida');
          }
          newStatus = ReturnStatus.OPEN_BOX;
          const openBoxVariant = await tx.productVariant.findFirst({
            where: { productId: ret.orderItem.variant.productId, tenantId, condition: data.targetCondition, listingStatus: 'LISTED' },
          });
          if (openBoxVariant) targetVariantId = openBoxVariant.id;
          else {
            const newVariant = await tx.productVariant.create({
              data: {
                tenantId,
                productId: ret.orderItem.variant.productId,
                sku: `${ret.orderItem.variant.sku}-${data.targetCondition}`,
                condition: data.targetCondition,
                listingStatus: 'LISTED',
                priceOverride: ret.orderItem.variant.priceOverride ? ret.orderItem.variant.priceOverride * 0.8 : null,
                images: ret.orderItem.variant.images,
              },
            });
            targetVariantId = newVariant.id;
          }
          break;
        case 'DAMAGE':
          newStatus = ReturnStatus.DAMAGED;
          const damagedVariant = await tx.productVariant.findFirst({
            where: { productId: ret.orderItem.variant.productId, tenantId, condition: 'DAMAGED' },
          });
          if (damagedVariant) targetVariantId = damagedVariant.id;
          else {
            const newVariant = await tx.productVariant.create({
              data: { tenantId, productId: ret.orderItem.variant.productId, sku: `${ret.orderItem.variant.sku}-DAMAGED`, condition: 'DAMAGED', listingStatus: 'UNLISTED' },
            });
            targetVariantId = newVariant.id;
          }
          break;
        case 'DISPOSE':
          newStatus = ReturnStatus.DISPOSED;
          break;
      }

      if (newStatus === ReturnStatus.RESTOCKED || newStatus === ReturnStatus.OPEN_BOX || newStatus === ReturnStatus.DAMAGED) {
        await this.inventory.processReturn(tenantId, {
          boxCode: `RET-${ret.id}`,
          locationId: ret.restockLocationId!,
          condition: targetVariantId === ret.orderItem.variantId ? ret.orderItem.variant.condition : data.targetCondition!,
          employeeId: userId,
          idempotencyKey: `return-${ret.id}-${uuidv4()}`,
          reason: `Devolución ${ret.id} - ${data.resolution}`,
        });
      }

      const updated = await tx.returnOrder.update({
        where: { id },
        data: {
          status: newStatus,
          resolution: data.resolution,
          refundAmount: data.refundAmount,
          inspectedById: userId,
          inspectedAt: new Date(),
        },
      });

      if (data.refundAmount && data.refundAmount > 0) {
        await tx.returnOrder.update({ where: { id }, data: { status: ReturnStatus.REFUNDED } });
      }

      await this.audit.logOrderEvent({
        tenantId,
        orderId: ret.orderId,
        event: 'RESOLUTION',
        newStatus,
        employeeId: userId,
        metadata: { returnId: id, resolution: data.resolution },
      });

      return updated;
    });
  }

  async getReturnStats(tenantId: string) {
    const [byStatus, byCategory, recent] = await Promise.all([
      this.prisma.returnOrder.groupBy({ by: ['status'], where: { tenantId }, _count: { status: true } }),
      this.prisma.returnOrder.groupBy({ by: ['reasonCategory'], where: { tenantId }, _count: { reasonCategory: true } }),
      this.prisma.returnOrder.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, status: true, reasonCategory: true, reason: true, createdAt: true } }),
    ]);

    return {
      byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count.status }), {}),
      byCategory: byCategory.reduce((acc, c) => ({ ...acc, [c.reasonCategory]: c._count.reasonCategory }), {}),
      recent,
    };
  }
}