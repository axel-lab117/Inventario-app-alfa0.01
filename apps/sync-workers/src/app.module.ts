import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ReturnsModule } from './modules/returns/returns.module';
import { MarketplacesModule } from './modules/marketplaces/marketplaces.module';
import { SyncModule } from './modules/sync/sync.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './config/redis.module';
import { RabbitMQModule } from './config/rabbitmq.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: (config) => {
        const required = [
          'DATABASE_URL',
          'JWT_SECRET',
          'REDIS_URL',
          'RABBITMQ_URL',
        ];
        for (const key of required) {
          if (!config[key]) {
            throw new Error(`Missing required env var: ${key}`);
          }
        }
        return config;
      },
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    PrismaModule,
    RedisModule,
    RabbitMQModule,
    AuditModule,
    HealthModule,
    AuthModule,
    TenantsModule,
    ProductsModule,
    InventoryModule,
    WarehouseModule,
    OrdersModule,
    ReturnsModule,
    MarketplacesModule,
    SyncModule,
    WebhooksModule,
  ],
})
export class AppModule {}