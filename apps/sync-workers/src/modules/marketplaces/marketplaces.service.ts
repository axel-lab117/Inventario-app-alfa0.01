import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../config/redis.service';
import { RabbitMQService } from '../../config/rabbitmq.service';
import { createAdapter } from '@repo/marketplace-adapters';
import { Marketplace, MarketplaceConnection, MarketplaceSettingsSchema } from '@repo/shared-types';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MarketplacesService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private rabbitmq: RabbitMQService,
  ) {}

  async findAll(tenantId: string) {
    return this.prisma.marketplaceConnection.findMany({
      where: { tenantId },
      include: { _count: { select: { products: true, orders: true, syncLogs: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const conn = await this.prisma.marketplaceConnection.findFirst({
      where: { id, tenantId },
      include: { syncLogs: { take: 10, orderBy: { startedAt: 'desc' } } },
    });
    if (!conn) throw new NotFoundException('Conexión no encontrada');
    return conn;
  }

  async create(tenantId: string, data: any, userRole: string) {
    if (userRole !== 'OWNER') throw new ForbiddenException('Solo owner puede crear conexiones');

    const parsed = MarketplaceConnectionSchema.omit({ id: true, tenantId: true, createdAt: true, updatedAt: true, status: true, lastSyncAt: true, lastError: true }).safeParse(data);
    if (!parsed.success) throw new BadRequestException(parsed.error.message);

    const adapter = createAdapter(data.marketplace);
    if (!adapter) throw new BadRequestException('Marketplace no soportado');

    const authResult = await adapter.authenticate(parsed.data.credentials);
    if (!authResult.success) throw new BadRequestException(`Autenticación fallida: ${authResult.error}`);

    const conn = await this.prisma.marketplaceConnection.create({
      data: {
        tenantId,
        marketplace: data.marketplace,
        name: data.name,
        credentials: parsed.data.credentials,
        settings: parsed.data.settings || {},
        status: 'ACTIVE',
        webhookUrl: `${process.env.PUBLIC_API_URL}/api/v1/webhooks/${data.marketplace.toLowerCase()}`,
        webhookSecret: uuidv4(),
      },
    });

    await this.registerWebhook(conn);
    return conn;
  }

  async update(tenantId: string, id: string, data: any, userRole: string) {
    if (userRole !== 'OWNER') throw new ForbiddenException('Solo owner puede modificar conexiones');

    const conn = await this.prisma.marketplaceConnection.findFirst({ where: { id, tenantId } });
    if (!conn) throw new NotFoundException('Conexión no encontrada');

    const parsed = MarketplaceConnectionSchema.omit({ id: true, tenantId: true, createdAt: true, updatedAt: true, status: true, lastSyncAt: true, lastError: true }).partial().safeParse(data);
    if (!parsed.success) throw new BadRequestException(parsed.error.message);

    if (parsed.data.credentials) {
      const adapter = createAdapter(conn.marketplace);
      const authResult = await adapter.authenticate(parsed.data.credentials);
      if (!authResult.success) throw new BadRequestException(`Autenticación fallida: ${authResult.error}`);
    }

    return this.prisma.marketplaceConnection.update({
      where: { id },
      data: parsed.data,
    });
  }

  async delete(tenantId: string, id: string, userRole: string) {
    if (userRole !== 'OWNER') throw new ForbiddenException('Solo owner puede eliminar conexiones');

    const conn = await this.prisma.marketplaceConnection.findFirst({ where: { id, tenantId } });
    if (!conn) throw new NotFoundException('Conexión no encontrada');

    await this.unregisterWebhook(conn);
    await this.prisma.marketplaceConnection.delete({ where: { id } });
  }

  async testConnection(tenantId: string, id: string) {
    const conn = await this.prisma.marketplaceConnection.findFirst({ where: { id, tenantId } });
    if (!conn) throw new NotFoundException('Conexión no encontrada');

    const adapter = createAdapter(conn.marketplace);
    if (!adapter) throw new BadRequestException('Marketplace no soportado');

    const success = await adapter.testConnection(conn.credentials as Record<string, string>);
    await this.prisma.marketplaceConnection.update({
      where: { id },
      data: { status: success ? 'ACTIVE' : 'ERROR', lastError: success ? null : 'Test fallido' },
    });

    return { success };
  }

  async syncNow(tenantId: string, id: string, types: string[] = ['STOCK', 'ORDERS']) {
    const conn = await this.prisma.marketplaceConnection.findFirst({ where: { id, tenantId } });
    if (!conn) throw new NotFoundException('Conexión no encontrada');

    await this.prisma.marketplaceConnection.update({ where: { id }, data: { status: 'SYNCING' } });

    for (const type of types) {
      await this.rabbitmq.publish('sync.execute', {
        type: type as any,
        tenantId,
        connectionId: id,
        correlationId: uuidv4(),
      });
    }

    return { success: true, queued: types };
  }

  async getProducts(tenantId: string, connectionId: string, params: { page?: number; limit?: number; search?: string }) {
    const { page = 1, limit = 50, search } = params;
    const where: any = { connectionId };
    if (search) where.OR = [{ marketplaceSku: { contains: search } }, { title: { contains: search } }];

    const [products, total] = await Promise.all([
      this.prisma.marketplaceProduct.findMany({
        where,
        include: { localVariant: { include: { product: true } } },
        orderBy: { lastSyncedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.marketplaceProduct.count({ where }),
    ]);

    return { products, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async linkProduct(tenantId: string, connectionId: string, marketplaceProductId: string, localVariantId: string) {
    return this.prisma.marketplaceProduct.update({
      where: { connectionId_marketplaceProductId: { connectionId, marketplaceProductId } },
      data: { localVariantId },
    });
  }

  async unlinkProduct(tenantId: string, connectionId: string, marketplaceProductId: string) {
    return this.prisma.marketplaceProduct.update({
      where: { connectionId_marketplaceProductId: { connectionId, marketplaceProductId } },
      data: { localVariantId: null },
    });
  }

  async getSyncLogs(tenantId: string, connectionId: string, limit = 50) {
    return this.prisma.syncLog.findMany({
      where: { connectionId, tenantId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  private async registerWebhook(conn: MarketplaceConnection) {
    if (!conn.webhookUrl) return;

    const adapter = createAdapter(conn.marketplace);
    if (!adapter || !adapter.createWebhook) return;

    try {
      await adapter.createWebhook(conn.credentials as Record<string, string>, conn.webhookUrl, conn.webhookSecret!);
    } catch (error) {
      console.error(`Failed to register webhook for ${conn.marketplace}:`, error);
    }
  }

  private async unregisterWebhook(conn: MarketplaceConnection) {
    // Implement per marketplace
  }
}

const MarketplaceConnectionSchema = z.object({
  marketplace: z.nativeEnum(Marketplace),
  name: z.string().min(1),
  credentials: z.record(z.string(), z.string()),
  settings: MarketplaceSettingsSchema.optional(),
});