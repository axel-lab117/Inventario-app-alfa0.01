import { Injectable } from '@nestjs/common';
import { QueueMessage } from '../../../config/rabbitmq.service';
import { SyncService } from '../sync.service';

@Injectable()
export class ProductSyncProcessor {
  constructor(private sync: SyncService) {}

  async process(batch: QueueMessage<{ type: 'PRODUCTS'; tenantId: string; connectionId: string }>[]) {
    for (const msg of batch) {
      await this.sync.executeSync(msg.payload.type, msg.payload.tenantId, msg.payload.connectionId, msg.correlationId!);
    }
  }
}