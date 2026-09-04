import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { RabbitMQService, QueueMessage } from '../../config/rabbitmq.service';
import { AuditService } from '../audit/audit.service';
import { Marketplace, SyncType, SyncStatus } from '@repo/shared-types';
import { createAdapter } from '@repo/marketplace-adapters';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SyncService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private rabbitmq: RabbitMQService,
    private audit: AuditService,
    private config: ConfigService,
  ) {}

  onModuleInit() {
    this.consumeQueues();
  }

  private consumeQueues() {
    this.rabbitmq.consume('wms.sync', async (msg: QueueMessage<{ type: SyncType; tenantId: string; connectionId: string }>) => {
      await this.executeSync(msg.payload.type, msg.payload.tenantId, msg.payload.connectionId, msg.correlationId!);
    });

    this.rabbitmq.consume('wms.webhook', async (msg: QueueMessage<any>) => {
      await this.processWebhookEvent(msg.payload);
    });
  }

  @Cron(CronExpression.EVERY_15_MINUTES)
  async scheduleAutomaticSyncs() {
    const connections = await this.prisma.marketplaceConnection.findMany({
      where: { syncEnabled: true, status: 'ACTIVE' },
      select: { id: true, tenantId: true, marketplace: true, syncIntervalMinutes: true },
    });

    for (const conn of connections) {
      if (conn.syncIntervalMinutes <= 15) {
        await this.rabbitmq.publish('sync.execute', {
          type: 'STOCK',
          tenantId: conn.tenantId,
          connectionId: conn.id,
          correlationId: uuidv4(),
        });
      }
    }
  }

  async executeSync(type: SyncType, tenantId: string, connectionId: string, correlationId: string) {
    const startTime = Date.now();
    const log = await this.prisma.syncLog.create({
      data: {
        tenantId,
        connectionId,
        type,
        status: SyncStatus.STARTED,
        startedAt: new Date(),
      },
    });

    const conn = await this.prisma.marketplaceConnection.findUnique({ where: { id: connectionId } });
    if (!conn) {
      await this.failSync(log.id, 'Conexión no encontrada', startTime);
      return;
    }

    const adapter = createAdapter(conn.marketplace);
    if (!adapter) {
      await this.failSync(log.id, 'Marketplace no soportado', startTime);
      return;
    }

    try {
      const credentials = conn.credentials as Record<string, string>;
      await adapter.authenticate(credentials);

      let recordsProcessed = 0;
      let recordsSucceeded = 0;
      let recordsFailed = 0;
      const errors: any[] = [];

      switch (type) {
        case 'STOCK':
          const stockResult = await this.syncStock(adapter, conn, credentials);
          recordsProcessed = stockResult.processed;
          recordsSucceeded = stockResult.succeeded;
          recordsFailed = stockResult.failed;
          errors.push(...stockResult.errors);
          break;
        case 'ORDERS':
          const orderResult = await this.syncOrders(adapter, conn, credentials);
          recordsProcessed = orderResult.processed;
          recordsSucceeded = orderResult.succeeded;
          recordsFailed = orderResult.failed;
          errors.push(...orderResult.errors);
          break;
        case 'PRODUCTS':
          const productResult = await this.syncProducts(adapter, conn, credentials);
          recordsProcessed = productResult.processed;
          recordsSucceeded = productResult.succeeded;
          recordsFailed = productResult.failed;
          errors.push(...productResult.errors);
          break;
        case 'PRICE':
          const priceResult = await this.syncPrices(adapter, conn, credentials);
          recordsProcessed = priceResult.processed;
          recordsSucceeded = priceResult.succeeded;
          recordsFailed = priceResult.failed;
          errors.push(...priceResult.errors);
          break;
        case 'FULL':
          await this.executeSync('STOCK', tenantId, connectionId, correlationId);
          await this.executeSync('ORDERS', tenantId, connectionId, correlationId);
          await this.executeSync('PRODUCTS', tenantId, connectionId, correlationId);
          await this.executeSync('PRICE', tenantId, connectionId, correlationId);
          break;
      }

      const duration = Date.now() - startTime;
      const status = recordsFailed > 0 && recordsSucceeded === 0 ? SyncStatus.FAILED : recordsFailed > 0 ? SyncStatus.PARTIAL : SyncStatus.SUCCESS;

      await this.prisma.syncLog.update({
        where: { id: log.id },
        data: { status, recordsProcessed, recordsSucceeded, recordsFailed, errors, completedAt: new Date() },
      });

      await this.prisma.marketplaceConnection.update({
        where: { id: connectionId },
        data: { lastSyncAt: new Date(), lastError: status === SyncStatus.FAILED ? errors[0]?.message : null },
      });

      await this.audit.logSyncEvent({
        tenantId,
        connectionId,
        type,
        status,
        recordsProcessed,
        recordsSucceeded,
        recordsFailed,
        errors,
        durationMs: duration,
      });

    } catch (error) {
      await this.failSync(log.id, error.message, startTime);
    }
  }

  private async failSync(logId: string, error: string, startTime: number) {
    await this.prisma.syncLog.update({
      where: { id: logId },
      data: { status: SyncStatus.FAILED, errors: [{ code: 'SYNC_ERROR', message: error }], completedAt: new Date() },
    });
  }

  private async syncStock(adapter: any, conn: any, credentials: Record<string, string>) {
    const result = { processed: 0, succeeded: 0, failed: 0, errors: [] as any[] };

    const localVariants = await this.prisma.productVariant.findMany({
      where: { tenantId: conn.tenantId, isActive: true },
      include: { stockLevels: { where: { quantity: { gt: 0 } } } },
    });

    for (const variant of localVariants) {
      const mpProduct = await this.prisma.marketplaceProduct.findFirst({
        where: { connectionId: conn.id, localVariantId: variant.id },
      });
      if (!mpProduct) continue;

      result.processed++;
      try {
        const totalStock = variant.stockLevels.reduce((sum, sl) => sum + sl.availableQuantity, 0);
        await adapter.updateStock(mpProduct.marketplaceProductId, totalStock);
        await this.prisma.marketplaceProduct.update({
          where: { id: mpProduct.id },
          data: { stock: totalStock, lastSyncedAt: new Date() },
        });
        result.succeeded++;
      } catch (error) {
        result.failed++;
        result.errors.push({ code: 'STOCK_SYNC_ERROR', message: error.message, recordId: variant.id });
      }
    }

    return result;
  }

  private async syncOrders(adapter: any, conn: any, credentials: Record<string, string>) {
    const result = { processed: 0, succeeded: 0, failed: 0, errors: [] as any[] };

    const settings = conn.settings as any;
    const since = settings.lastOrderSync ? new Date(settings.lastOrderSync) : new Date(Date.now() - 24 * 60 * 60 * 1000);

    const orders = await adapter.fetchOrders({ dateFrom: since, limit: 100 });

    for (const mpOrder of orders) {
      result.processed++;
      try {
        await this.importOrder(conn, mpOrder);
        result.succeeded++;
      } catch (error) {
        result.failed++;
        result.errors.push({ code: 'ORDER_SYNC_ERROR', message: error.message, recordId: mpOrder.id });
      }
    }

    await this.prisma.marketplaceConnection.update({
      where: { id: conn.id },
      data: { settings: { ...settings, lastOrderSync: new Date().toISOString() } },
    });

    return result;
  }

  private async syncProducts(adapter: any, conn: any, credentials: Record<string, string>) {
    const result = { processed: 0, succeeded: 0, failed: 0, errors: [] as any[] };

    const products = await adapter.fetchProducts({ limit: 500 });

    for (const mpProduct of products) {
      result.processed++;
      try {
        await this.prisma.marketplaceProduct.upsert({
          where: { connectionId_marketplaceProductId: { connectionId: conn.id, marketplaceProductId: mpProduct.id } },
          update: { title: mpProduct.title, price: mpProduct.price, stock: mpProduct.stock, status: mpProduct.status, images: mpProduct.images, attributes: mpProduct.attributes, lastSyncedAt: new Date() },
          create: {
            tenantId: conn.tenantId,
            connectionId: conn.id,
            marketplaceProductId: mpProduct.id,
            marketplaceSku: mpProduct.sku,
            title: mpProduct.title,
            price: mpProduct.price,
            stock: mpProduct.stock,
            status: mpProduct.status,
            images: mpProduct.images,
            attributes: mpProduct.attributes,
            lastSyncedAt: new Date(),
          },
        });
        result.succeeded++;
      } catch (error) {
        result.failed++;
        result.errors.push({ code: 'PRODUCT_SYNC_ERROR', message: error.message, recordId: mpProduct.id });
      }
    }

    return result;
  }

  private async syncPrices(adapter: any, conn: any, credentials: Record<string, string>) {
    const result = { processed: 0, succeeded: 0, failed: 0, errors: [] as any[] };

    const variants = await this.prisma.productVariant.findMany({
      where: { tenantId: conn.tenantId, isActive: true, priceOverride: { not: null } },
      include: { marketplaceProducts: { where: { connectionId: conn.id } } },
    });

    for (const variant of variants) {
      for (const mpProduct of variant.marketplaceProducts) {
        result.processed++;
        try {
          await adapter.updatePrice(mpProduct.marketplaceProductId, variant.priceOverride!);
          result.succeeded++;
        } catch (error) {
          result.failed++;
          result.errors.push({ code: 'PRICE_SYNC_ERROR', message: error.message, recordId: variant.id });
        }
      }
    }

    return result;
  }

  private async importOrder(conn: any, mpOrder: any) {
    const existing = await this.prisma.order.findFirst({
      where: { tenantId: conn.tenantId, source: conn.marketplace, sourceOrderId: mpOrder.id },
    });
    if (existing) return existing;

    const items = await Promise.all(mpOrder.items.map(async (item: any) => {
      let variant = null;
      if (item.sku) {
        variant = await this.prisma.productVariant.findFirst({
          where: { tenantId: conn.tenantId, sku: item.sku },
        });
      }

      return {
        variantId: variant?.id,
        sku: item.sku,
        name: item.title,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        condition: item.condition || 'NEW',
        marketplaceItemId: item.id,
      };
    }));

    return this.prisma.order.create({
      data: {
        tenantId: conn.tenantId,
        source: conn.marketplace,
        sourceOrderId: mpOrder.id,
        sourceOrderNumber: mpOrder.orderNumber,
        status: 'PENDING',
        customer: mpOrder.buyer,
        shippingAddress: mpOrder.shipping?.address ? {
          street: mpOrder.shipping.address.street,
          number: mpOrder.shipping.address.number,
          city: mpOrder.shipping.address.city,
          state: mpOrder.shipping.address.state,
          postalCode: mpOrder.shipping.address.zip_code,
          country: mpOrder.shipping.address.country_id || 'AR',
        } : {},
        items: { create: items },
        subtotal: mpOrder.total,
        total: mpOrder.total,
        currency: mpOrder.currency,
        marketplaceData: mpOrder.rawData,
      },
    });
  }

  async processWebhookEvent(payload: any) {
    // Handled by WebhooksModule
  }
}