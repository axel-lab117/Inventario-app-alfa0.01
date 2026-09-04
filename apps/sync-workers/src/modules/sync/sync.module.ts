import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { StockSyncProcessor } from './processors/stock-sync.processor';
import { OrderSyncProcessor } from './processors/order-sync.processor';
import { ProductSyncProcessor } from './processors/product-sync.processor';
import { PriceSyncProcessor } from './processors/price-sync.processor';
import { FullSyncProcessor } from './processors/full-sync.processor';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [SyncController],
  providers: [
    SyncService,
    StockSyncProcessor,
    OrderSyncProcessor,
    ProductSyncProcessor,
    PriceSyncProcessor,
    FullSyncProcessor,
  ],
  exports: [SyncService],
})
export class SyncModule {}