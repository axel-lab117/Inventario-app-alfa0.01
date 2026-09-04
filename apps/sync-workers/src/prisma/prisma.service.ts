import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      errorFormat: 'pretty',
    });
  }

  async onModuleInit() {
    await this.$connect();
    await this.setupMultiTenancy();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async setupMultiTenancy() {
    this.$use(async (params, next) => {
      if (params.model && ['User', 'Product', 'ProductVariant', 'Location', 'StockLevel', 'StockMovement', 'Order', 'OrderItem', 'ReturnOrder', 'PickingTask', 'PickingTaskItem', 'MarketplaceConnection', 'MarketplaceProduct', 'MarketplaceOrder', 'WarehouseMap', 'Zone', 'ApiKey', 'SyncLog', 'WebhookEvent'].includes(params.model)) {
        if (params.action === 'findUnique' || params.action === 'findFirst') {
          params.action = 'findFirst';
          params.args.where = { ...params.args.where, tenantId: this.getTenantId() };
        } else if (params.action === 'findMany') {
          params.args.where = { ...params.args.where, tenantId: this.getTenantId() };
        } else if (params.action === 'create' || params.action === 'createMany') {
          const data = params.args.data || (params.args as any).data?.[0];
          if (data && !data.tenantId) {
            data.tenantId = this.getTenantId();
          }
        } else if (params.action === 'update' || params.action === 'updateMany') {
          params.args.where = { ...params.args.where, tenantId: this.getTenantId() };
        } else if (params.action === 'delete' || params.action === 'deleteMany') {
          params.args.where = { ...params.args.where, tenantId: this.getTenantId() };
        }
      }
      return next(params);
    });
  }

  private getTenantId(): string | undefined {
    return (global as any).currentTenantId;
  }

  static setTenantId(tenantId: string) {
    (global as any).currentTenantId = tenantId;
  }

  static clearTenantId() {
    (global as any).currentTenantId = undefined;
  }

  cleanDatabase() {
    if (process.env.NODE_ENV === 'production') return;
    return this.$transaction([
      this.webhookEvent.deleteMany(),
      this.syncLog.deleteMany(),
      this.marketplaceOrder.deleteMany(),
      this.marketplaceProduct.deleteMany(),
      this.marketplaceConnection.deleteMany(),
      this.pickingTaskItem.deleteMany(),
      this.pickingTask.deleteMany(),
      this.returnOrder.deleteMany(),
      this.orderItem.deleteMany(),
      this.order.deleteMany(),
      this.zone.deleteMany(),
      this.warehouseMap.deleteMany(),
      this.stockMovement.deleteMany(),
      this.stockLevel.deleteMany(),
      this.location.deleteMany(),
      this.productVariant.deleteMany(),
      this.product.deleteMany(),
      this.apiKey.deleteMany(),
      this.user.deleteMany(),
      this.tenant.deleteMany(),
    ]);
  }
}

export const PrismaTransactionClient = Prisma.TransactionClient;