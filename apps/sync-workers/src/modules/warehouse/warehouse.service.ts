import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../config/redis.service';
import { WarehouseMapSchema, ZoneSchema } from '@repo/shared-types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WarehouseService {
  private readonly MAP_CACHE_PREFIX = 'warehouse:map:';
  private readonly OCCUPANCY_CACHE_PREFIX = 'warehouse:occupancy:';

  constructor(private prisma: PrismaService, private redis: RedisService) {}

  async getMaps(tenantId: string) {
    return this.prisma.warehouseMap.findMany({
      where: { tenantId },
      include: { zones: true, _count: { select: { zones: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getMap(tenantId: string, mapId: string) {
    const cacheKey = `${this.MAP_CACHE_PREFIX}${tenantId}:${mapId}`;
    const cached = await this.redis.getCache(cacheKey);
    if (cached) return cached;

    const map = await this.prisma.warehouseMap.findFirst({
      where: { id: mapId, tenantId },
      include: { zones: true },
    });
    if (!map) throw new NotFoundException('Mapa no encontrado');

    await this.redis.setCache(cacheKey, map, 600);
    return map;
  }

  async createMap(tenantId: string, data: any) {
    const parsed = WarehouseMapSchema.omit({ id: true, tenantId: true, createdAt: true, updatedAt: true }).safeParse(data);
    if (!parsed.success) throw new BadRequestException(parsed.error.message);

    const map = await this.prisma.warehouseMap.create({
      data: { ...parsed.data, tenantId, zones: { create: parsed.data.zones || [] } },
      include: { zones: true },
    });

    await this.invalidateMapCache(tenantId, map.id);
    return map;
  }

  async updateMap(tenantId: string, mapId: string, data: any) {
    const map = await this.prisma.warehouseMap.findFirst({ where: { id: mapId, tenantId } });
    if (!map) throw new NotFoundException('Mapa no encontrado');

    const parsed = WarehouseMapSchema.omit({ id: true, tenantId: true, createdAt: true, updatedAt: true }).partial().safeParse(data);
    if (!parsed.success) throw new BadRequestException(parsed.error.message);

    const updated = await this.prisma.warehouseMap.update({
      where: { id: mapId },
      data: {
        name: parsed.data.name,
        svgContent: parsed.data.svgContent,
        viewBox: parsed.data.viewBox,
        scale: parsed.data.scale,
        zones: parsed.data.zones ? { deleteMany: {}, create: parsed.data.zones } : undefined,
      },
      include: { zones: true },
    });

    await this.invalidateMapCache(tenantId, mapId);
    return updated;
  }

  async deleteMap(tenantId: string, mapId: string) {
    await this.prisma.warehouseMap.delete({ where: { id: mapId, tenantId } });
    await this.invalidateMapCache(tenantId, mapId);
  }

  async getLocations(tenantId: string, params: { mapId?: string; type?: string; parentId?: string; search?: string }) {
    const { mapId, type, parentId, search } = params;
    const where: any = { tenantId, isActive: true };

    if (mapId) {
      const map = await this.getMap(tenantId, mapId);
      const locationIds = map.zones.flatMap(z => z.locationIds);
      where.id = { in: locationIds };
    }
    if (type) where.type = type;
    if (parentId) where.parentId = parentId;
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.location.findMany({
      where,
      include: { children: true, _count: { select: { stockLevels: true } } },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
    });
  }

  async getLocationTree(tenantId: string) {
    const roots = await this.prisma.location.findMany({
      where: { tenantId, parentId: null, isActive: true },
      include: { children: { include: { children: { include: { children: true } } } } },
      orderBy: { code: 'asc' },
    });
    return roots;
  }

  async createLocation(tenantId: string, data: any) {
    const location = await this.prisma.location.create({
      data: { ...data, tenantId },
    });
    await this.invalidateOccupancyCache(tenantId);
    return location;
  }

  async updateLocation(tenantId: string, locationId: string, data: any) {
    const location = await this.prisma.location.findFirst({ where: { id: locationId, tenantId } });
    if (!location) throw new NotFoundException('Ubicación no encontrada');

    return this.prisma.location.update({ where: { id: locationId }, data });
  }

  async deleteLocation(tenantId: string, locationId: string) {
    const children = await this.prisma.location.count({ where: { parentId: locationId } });
    if (children > 0) throw new BadRequestException('No se puede eliminar: tiene ubicaciones hijas');

    const stock = await this.prisma.stockLevel.count({ where: { locationId, quantity: { gt: 0 } } });
    if (stock > 0) throw new BadRequestException('No se puede eliminar: tiene stock');

    await this.prisma.location.delete({ where: { id: locationId, tenantId } });
    await this.invalidateOccupancyCache(tenantId);
  }

  async getOccupancy(tenantId: string, mapId?: string) {
    const cacheKey = `${this.OCCUPANCY_CACHE_PREFIX}${tenantId}:${mapId || 'all'}`;
    const cached = await this.redis.getCache(cacheKey);
    if (cached) return cached;

    const where: any = { tenantId, type: 'BIN', isActive: true };
    if (mapId) {
      const map = await this.getMap(tenantId, mapId);
      where.id = { in: map.zones.flatMap(z => z.locationIds) };
    }

    const bins = await this.prisma.location.findMany({
      where,
      include: { stockLevels: { where: { quantity: { gt: 0 } }, include: { variant: { include: { product: true } } } } },
    });

    const occupancy = bins.map(bin => {
      const usedCapacity = bin.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0);
      const skuCount = new Set(bin.stockLevels.map(sl => sl.variant.productId)).size;
      const variantCount = bin.stockLevels.length;
      const totalCapacity = bin.capacity || 0;
      const occupancyPercent = totalCapacity > 0 ? Math.round((usedCapacity / totalCapacity) * 100) : 0;

      return {
        locationId: bin.id,
        code: bin.code,
        name: bin.name,
        usedCapacity,
        totalCapacity,
        occupancyPercent,
        skuCount,
        variantCount,
        coordinates: bin.coordinates,
      };
    });

    await this.redis.setCache(cacheKey, occupancy, 60);
    return occupancy;
  }

  async getPickingRoute(tenantId: string, orderIds: string[]) {
    const items = await this.prisma.orderItem.findMany({
      where: { orderId: { in: orderIds }, pickedQuantity: { lt: { gte: 1 } } },
      include: { variant: { include: { stockLevels: { where: { availableQuantity: { gt: 0 } }, include: { location: true }, orderBy: { availableQuantity: 'desc' } } } } },
    });

    const locationSequence: Map<string, { locationId: string; sequence: number; items: any[] }> = new Map();
    let sequence = 0;

    for (const item of items) {
      const bestStock = item.variant.stockLevels[0];
      if (!bestStock) continue;

      const key = bestStock.locationId;
      if (!locationSequence.has(key)) {
        sequence++;
        locationSequence.set(key, { locationId: key, sequence, items: [] });
      }
      locationSequence.get(key)!.items.push({
        variantId: item.variantId,
        sku: item.variant.sku,
        name: item.variant.product.name,
        requiredQuantity: item.quantity - item.pickedQuantity,
        locationId: bestStock.locationId,
      });
    }

    const locations = Array.from(locationSequence.values()).sort((a, b) => a.sequence - b.sequence);

    return this.prisma.pickingRoute.create({
      data: {
        tenantId,
        orderIds,
        locations: locations.map(l => ({ locationId: l.locationId, sequence: l.sequence, estimatedTimeSeconds: 30 })),
        totalEstimatedTimeSeconds: locations.length * 30,
        totalDistanceMeters: locations.length * 10,
        status: 'PENDING',
      },
      include: { locations: { include: { location: true } } },
    });
  }

  async getPickingRoutes(tenantId: string, status?: string) {
    return this.prisma.pickingRoute.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      include: { locations: { include: { location: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async startPickingRoute(tenantId: string, routeId: string, employeeId: string) {
    return this.prisma.pickingRoute.update({
      where: { id: routeId, tenantId },
      data: { status: 'IN_PROGRESS', assignedTo: employeeId, startedAt: new Date() },
    });
  }

  async completePickingRoute(tenantId: string, routeId: string) {
    return this.prisma.pickingRoute.update({
      where: { id: routeId, tenantId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }

  async getSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    return tenant?.settings?.warehouse || {};
  }

  async updateSettings(tenantId: string, settings: any) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const current = tenant?.settings || {};
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: { ...current, warehouse: settings } },
    });
  }

  private async invalidateMapCache(tenantId: string, mapId?: string) {
    if (mapId) {
      await this.redis.del(`${this.MAP_CACHE_PREFIX}${tenantId}:${mapId}`);
    }
    await this.redis.invalidatePattern(`${this.MAP_CACHE_PREFIX}${tenantId}:*`);
  }

  private async invalidateOccupancyCache(tenantId: string) {
    await this.redis.invalidatePattern(`${this.OCCUPANCY_CACHE_PREFIX}${tenantId}:*`);
  }
}