import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../config/redis.service';
import { RabbitMQService, QueueMessage } from '../../config/rabbitmq.service';
import { AuditService } from '../audit/audit.service';
import { StockMovementType, ProductCondition } from '@repo/shared-types';
import { v4 as uuidv4 } from 'uuid';

interface StockLevelInfo {
  variantId: string;
  locationId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

@Injectable()
export class InventoryService {
  private readonly STOCK_CACHE_TTL = 300;
  private readonly STOCK_CACHE_PREFIX = 'stock:';

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private rabbitmq: RabbitMQService,
    private audit: AuditService,
  ) {}

  async getStockLevels(tenantId: string, params: { variantId?: string; locationId?: string; lowStock?: boolean; page?: number; limit?: number }) {
    const { variantId, locationId, lowStock, page = 1, limit = 50 } = params;
    const where: any = { tenantId };

    if (variantId) where.variantId = variantId;
    if (locationId) where.locationId = locationId;
    if (lowStock) where.availableQuantity = { lte: 10 };

    const [levels, total] = await Promise.all([
      this.prisma.stockLevel.findMany({
        where,
        include: { variant: { include: { product: true } }, location: true },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockLevel.count({ where }),
    ]);

    return { levels, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getStockLevel(tenantId: string, variantId: string, locationId: string) {
    const cacheKey = `${this.STOCK_CACHE_PREFIX}${tenantId}:${variantId}:${locationId}`;
    const cached = await this.redis.getCache<StockLevelInfo>(cacheKey);
    if (cached) return cached;

    const level = await this.prisma.stockLevel.findUnique({
      where: { variantId_locationId: { variantId, locationId } },
      include: { variant: { include: { product: true } }, location: true },
    });

    if (!level) return null;

    const info: StockLevelInfo = {
      variantId: level.variantId,
      locationId: level.locationId,
      quantity: level.quantity,
      reservedQuantity: level.reservedQuantity,
      availableQuantity: level.availableQuantity,
    };

    await this.redis.setCache(cacheKey, info, this.STOCK_CACHE_TTL);
    return info;
  }

  async getAvailableStock(tenantId: string, variantId: string) {
    const levels = await this.prisma.stockLevel.findMany({
      where: { variantId, tenantId, availableQuantity: { gt: 0 } },
      include: { location: true },
      orderBy: { availableQuantity: 'desc' },
    });
    return levels.reduce((sum, l) => sum + l.availableQuantity, 0);
  }

  async adjustStock(tenantId: string, data: { variantId: string; locationId: string; newQuantity: number; reason: string; employeeId: string }) {
    const { variantId, locationId, newQuantity, reason, employeeId } = data;

    if (newQuantity < 0) throw new BadRequestException('La cantidad no puede ser negativa');

    const variant = await this.prisma.productVariant.findFirst({ where: { id: variantId, tenantId } });
    if (!variant) throw new NotFoundException('Variante no encontrada');

    const location = await this.prisma.location.findFirst({ where: { id: locationId, tenantId } });
    if (!location) throw new NotFoundException('Ubicación no encontrada');

    return this.prisma.$transaction(async (tx) => {
      const currentLevel = await tx.stockLevel.findUnique({
        where: { variantId_locationId: { variantId, locationId } },
      });

      const previousQuantity = currentLevel?.quantity || 0;
      const quantityDiff = newQuantity - previousQuantity;
      const type = quantityDiff > 0 ? StockMovementType.ADJUSTMENT : StockMovementType.ADJUSTMENT;

      const level = await tx.stockLevel.upsert({
        where: { variantId_locationId: { variantId, locationId } },
        create: {
          tenantId,
          variantId,
          locationId,
          quantity: newQuantity,
          reservedQuantity: 0,
          availableQuantity: newQuantity,
        },
        update: {
          quantity: newQuantity,
          availableQuantity: newQuantity - (currentLevel?.reservedQuantity || 0),
          lastCountedAt: new Date(),
        },
      });

      const idempotencyKey = uuidv4();
      await tx.stockMovement.create({
        data: {
          tenantId,
          variantId,
          locationId,
          type,
          quantity: quantityDiff,
          reason,
          employeeId,
          idempotencyKey,
          metadata: { adjustment: true, previousQuantity, newQuantity },
        },
      });

      await this.invalidateStockCache(tenantId, variantId, locationId);
      await this.publishStockEvent(tenantId, variantId, locationId, newQuantity, level.availableQuantity);

      await this.audit.logStockMovement({
        tenantId,
        variantId,
        locationId,
        type,
        quantity: quantityDiff,
        previousQuantity,
        newQuantity,
        employeeId,
        metadata: { adjustment: true, reason },
      });

      return level;
    });
  }

  async moveStock(tenantId: string, data: { variantId: string; fromLocationId: string; toLocationId: string; quantity: number; employeeId: string; reason?: string }) {
    const { variantId, fromLocationId, toLocationId, quantity, employeeId, reason } = data;

    if (quantity <= 0) throw new BadRequestException('La cantidad debe ser positiva');
    if (fromLocationId === toLocationId) throw new BadRequestException('Origen y destino no pueden ser iguales');

    return this.prisma.$transaction(async (tx) => {
      const fromLevel = await tx.stockLevel.findUnique({
        where: { variantId_locationId: { variantId, locationId: fromLocationId } },
      });
      if (!fromLevel || fromLevel.availableQuantity < quantity) {
        throw new BadRequestException('Stock insuficiente en ubicación origen');
      }

      const toLevel = await tx.stockLevel.findUnique({
        where: { variantId_locationId: { variantId, locationId: toLocationId } },
      });

      const idempotencyKey = uuidv4();

      await tx.stockLevel.update({
        where: { variantId_locationId: { variantId, locationId: fromLocationId } },
        data: {
          quantity: { decrement: quantity },
          availableQuantity: { decrement: quantity },
        },
      });

      await tx.stockLevel.upsert({
        where: { variantId_locationId: { variantId, locationId: toLocationId } },
        create: { tenantId, variantId, locationId: toLocationId, quantity, reservedQuantity: 0, availableQuantity: quantity },
        update: { quantity: { increment: quantity }, availableQuantity: { increment: quantity } },
      });

      await tx.stockMovement.createMany({
        data: [
          {
            tenantId,
            variantId,
            locationId: fromLocationId,
            type: StockMovementType.TRANSFER_OUT,
            quantity: -quantity,
            employeeId,
            reason,
            idempotencyKey: `${idempotencyKey}-out`,
            metadata: { transferTo: toLocationId },
          },
          {
            tenantId,
            variantId,
            locationId: toLocationId,
            type: StockMovementType.TRANSFER_IN,
            quantity,
            employeeId,
            reason,
            idempotencyKey: `${idempotencyKey}-in`,
            metadata: { transferFrom: fromLocationId },
          },
        ],
      });

      await this.invalidateStockCache(tenantId, variantId, fromLocationId);
      await this.invalidateStockCache(tenantId, variantId, toLocationId);
      await this.publishStockEvent(tenantId, variantId, fromLocationId, fromLevel.quantity - quantity, fromLevel.availableQuantity - quantity);
      if (toLevel) {
        await this.publishStockEvent(tenantId, variantId, toLocationId, toLevel.quantity + quantity, toLevel.availableQuantity + quantity);
      }

      return { success: true };
    });
  }

  async reserveStock(tenantId: string, variantId: string, locationId: string, quantity: number, referenceId: string, referenceType: string) {
    return this.prisma.$transaction(async (tx) => {
      const level = await tx.stockLevel.findUnique({
        where: { variantId_locationId: { variantId, locationId } },
      });
      if (!level || level.availableQuantity < quantity) {
        throw new BadRequestException('Stock disponible insuficiente para reservar');
      }

      await tx.stockLevel.update({
        where: { variantId_locationId: { variantId, locationId } },
        data: { reservedQuantity: { increment: quantity }, availableQuantity: { decrement: quantity } },
      });

      await this.invalidateStockCache(tenantId, variantId, locationId);
      await this.publishStockEvent(tenantId, variantId, locationId, level.quantity, level.availableQuantity - quantity);

      return { success: true, reserved: quantity };
    });
  }

  async releaseReservation(tenantId: string, variantId: string, locationId: string, quantity: number) {
    return this.prisma.$transaction(async (tx) => {
      const level = await tx.stockLevel.findUnique({
        where: { variantId_locationId: { variantId, locationId } },
      });
      if (!level) throw new NotFoundException('Nivel de stock no encontrado');

      await tx.stockLevel.update({
        where: { variantId_locationId: { variantId, locationId } },
        data: { reservedQuantity: { decrement: quantity }, availableQuantity: { increment: quantity } },
      });

      await this.invalidateStockCache(tenantId, variantId, locationId);
      await this.publishStockEvent(tenantId, variantId, locationId, level.quantity, level.availableQuantity + quantity);

      return { success: true };
    });
  }

  async processRemoval(tenantId: string, data: { boxCode: string; locationId: string; employeeId: string; idempotencyKey: string }) {
    const { boxCode, locationId, employeeId, idempotencyKey } = data;

    const existing = await this.prisma.stockMovement.findUnique({ where: { idempotencyKey } });
    if (existing) return { success: true, duplicate: true, movement: existing };

    const parsed = this.parseBoxCode(boxCode);
    if (!parsed) throw new BadRequestException('Código de caja no reconocido');

    const variant = await this.prisma.productVariant.findFirst({
      where: { tenantId, sku: parsed.sku },
    });
    if (!variant) throw new NotFoundException(`SKU ${parsed.sku} no encontrado`);

    return this.prisma.$transaction(async (tx) => {
      const level = await tx.stockLevel.findUnique({
        where: { variantId_locationId: { variantId: variant.id, locationId } },
      });
      if (!level || level.availableQuantity < 1) {
        throw new BadRequestException('Stock insuficiente para retirar');
      }

      await tx.stockLevel.update({
        where: { variantId_locationId: { variantId: variant.id, locationId } },
        data: { quantity: { decrement: 1 }, availableQuantity: { decrement: 1 } },
      });

      const movement = await tx.stockMovement.create({
        data: {
          tenantId,
          variantId: variant.id,
          locationId,
          type: StockMovementType.REMOVE,
          quantity: -1,
          employeeId,
          reason: `Retiro caja ${boxCode}`,
          idempotencyKey,
          metadata: { boxCode, sequence: parsed.sequence },
        },
      });

      await this.invalidateStockCache(tenantId, variant.id, locationId);
      await this.publishStockEvent(tenantId, variant.id, locationId, level.quantity - 1, level.availableQuantity - 1);

      await this.audit.logStockMovement({
        tenantId,
        variantId: variant.id,
        locationId,
        type: StockMovementType.REMOVE,
        quantity: -1,
        previousQuantity: level.quantity,
        newQuantity: level.quantity - 1,
        employeeId,
        metadata: { boxCode, sequence: parsed.sequence },
      });

      return { success: true, movement };
    });
  }

  async processReturn(tenantId: string, data: { boxCode: string; locationId: string; condition: ProductCondition; employeeId: string; idempotencyKey: string; reason?: string }) {
    const { boxCode, locationId, condition, employeeId, idempotencyKey, reason } = data;

    const existing = await this.prisma.stockMovement.findUnique({ where: { idempotencyKey } });
    if (existing) return { success: true, duplicate: true, movement: existing };

    const parsed = this.parseBoxCode(boxCode);
    if (!parsed) throw new BadRequestException('Código de caja no reconocido');

    const variant = await this.prisma.productVariant.findFirst({
      where: { tenantId, sku: parsed.sku },
    });
    if (!variant) throw new NotFoundException(`SKU ${parsed.sku} no encontrado`);

    let targetVariantId = variant.id;
    if (condition !== 'NEW' && condition !== 'DAMAGED') {
      const openBoxVariant = await this.prisma.productVariant.findFirst({
        where: { productId: variant.productId, tenantId, condition, listingStatus: 'LISTED' },
      });
      if (openBoxVariant) targetVariantId = openBoxVariant.id;
    }

    return this.prisma.$transaction(async (tx) => {
      const level = await tx.stockLevel.findUnique({
        where: { variantId_locationId: { variantId: targetVariantId, locationId } },
      });

      await tx.stockLevel.upsert({
        where: { variantId_locationId: { variantId: targetVariantId, locationId } },
        create: { tenantId, variantId: targetVariantId, locationId, quantity: 1, reservedQuantity: 0, availableQuantity: 1 },
        update: { quantity: { increment: 1 }, availableQuantity: { increment: 1 } },
      });

      const movement = await tx.stockMovement.create({
        data: {
          tenantId,
          variantId: targetVariantId,
          locationId,
          type: StockMovementType.RETURN,
          quantity: 1,
          employeeId,
          reason: reason || `Devolución caja ${boxCode} - ${condition}`,
          idempotencyKey,
          metadata: { boxCode, sequence: parsed.sequence, originalCondition: variant.condition, newCondition: condition },
        },
      });

      await this.invalidateStockCache(tenantId, targetVariantId, locationId);
      const newQty = (level?.quantity || 0) + 1;
      const newAvail = (level?.availableQuantity || 0) + 1;
      await this.publishStockEvent(tenantId, targetVariantId, locationId, newQty, newAvail);

      await this.audit.logStockMovement({
        tenantId,
        variantId: targetVariantId,
        locationId,
        type: StockMovementType.RETURN,
        quantity: 1,
        previousQuantity: level?.quantity || 0,
        newQuantity: newQty,
        employeeId,
        metadata: { boxCode, sequence: parsed.sequence, condition },
      });

      return { success: true, movement, variantId: targetVariantId };
    });
  }

  async convertToOpenBox(tenantId: string, data: { variantId: string; locationId: string; targetCondition: ProductCondition; quantity: number; employeeId: string; reason?: string }) {
    const { variantId, locationId, targetCondition, quantity, employeeId, reason } = data;

    if (!['OPEN_BOX_A', 'OPEN_BOX_B', 'OPEN_BOX_C'].includes(targetCondition)) {
      throw new BadRequestException('Condición debe ser OPEN_BOX_A, OPEN_BOX_B u OPEN_BOX_C');
    }

    return this.prisma.$transaction(async (tx) => {
      const sourceLevel = await tx.stockLevel.findUnique({
        where: { variantId_locationId: { variantId, locationId } },
      });
      if (!sourceLevel || sourceLevel.availableQuantity < quantity) {
        throw new BadRequestException('Stock insuficiente para convertir');
      }

      const sourceVariant = await tx.productVariant.findUnique({ where: { id: variantId } });
      if (!sourceVariant) throw new NotFoundException('Variante origen no encontrada');

      let targetVariant = await tx.productVariant.findFirst({
        where: { productId: sourceVariant.productId, tenantId, condition: targetCondition, listingStatus: 'LISTED' },
      });

      if (!targetVariant) {
        targetVariant = await tx.productVariant.create({
          data: {
            tenantId,
            productId: sourceVariant.productId,
            sku: `${sourceVariant.sku}-${targetCondition}`,
            condition: targetCondition,
            listingStatus: 'LISTED',
            priceOverride: sourceVariant.priceOverride ? sourceVariant.priceOverride * 0.8 : null,
            costOverride: sourceVariant.costOverride,
            images: sourceVariant.images,
            attributes: { ...sourceVariant.attributes, openBoxOrigin: sourceVariant.sku },
          },
        });
      }

      await tx.stockLevel.update({
        where: { variantId_locationId: { variantId, locationId } },
        data: { quantity: { decrement: quantity }, availableQuantity: { decrement: quantity } },
      });

      await tx.stockLevel.upsert({
        where: { variantId_locationId: { variantId: targetVariant.id, locationId } },
        create: { tenantId, variantId: targetVariant.id, locationId, quantity, reservedQuantity: 0, availableQuantity: quantity },
        update: { quantity: { increment: quantity }, availableQuantity: { increment: quantity } },
      });

      const idempotencyKey = uuidv4();
      await tx.stockMovement.createMany({
        data: [
          {
            tenantId,
            variantId,
            locationId,
            type: StockMovementType.OPEN_BOX_CONVERSION,
            quantity: -quantity,
            employeeId,
            reason: reason || `Conversión a ${targetCondition}`,
            idempotencyKey: `${idempotencyKey}-out`,
            metadata: { targetVariantId: targetVariant.id, targetCondition },
          },
          {
            tenantId,
            variantId: targetVariant.id,
            locationId,
            type: StockMovementType.OPEN_BOX_CONVERSION,
            quantity,
            employeeId,
            reason: reason || `Conversión desde ${sourceVariant.condition}`,
            idempotencyKey: `${idempotencyKey}-in`,
            metadata: { sourceVariantId: variantId, sourceCondition: sourceVariant.condition },
          },
        ],
      });

      await this.invalidateStockCache(tenantId, variantId, locationId);
      await this.invalidateStockCache(tenantId, targetVariant.id, locationId);

      return { success: true, targetVariantId: targetVariant.id, quantity };
    });
  }

  async getMovements(tenantId: string, params: { variantId?: string; locationId?: string; type?: string; employeeId?: string; from?: Date; to?: Date; page?: number; limit?: number }) {
    const { variantId, locationId, type, employeeId, from, to, page = 1, limit = 50 } = params;
    const where: any = { tenantId };

    if (variantId) where.variantId = variantId;
    if (locationId) where.locationId = locationId;
    if (type) where.type = type;
    if (employeeId) where.employeeId = employeeId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }

    const [movements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: { variant: { include: { product: true } }, location: true, employee: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return { movements, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  private async invalidateStockCache(tenantId: string, variantId: string, locationId: string) {
    const cacheKey = `${this.STOCK_CACHE_PREFIX}${tenantId}:${variantId}:${locationId}`;
    await this.redis.del(cacheKey);
    await this.redis.del(`${this.STOCK_CACHE_PREFIX}${tenantId}:${variantId}:*`);
  }

  private async publishStockEvent(tenantId: string, variantId: string, locationId: string, quantity: number, available: number) {
    await this.rabbitmq.publishEvent('stock.updated', {
      tenantId,
      variantId,
      locationId,
      quantity,
      available,
      timestamp: Date.now(),
    });
  }

  private parseBoxCode(code: string): { sku: string; sequence: string } | null {
    const patterns = [
      /^BOX-(\w+)-(\d+)$/i,
      /^(\w{8,12})-(\d{3,6})$/i,
      /^\[(\w+)\]-(\d+)$/i,
    ];

    for (const pattern of patterns) {
      const match = code.match(pattern);
      if (match) return { sku: match[1], sequence: match[2] };
    }
    return null;
  }
}