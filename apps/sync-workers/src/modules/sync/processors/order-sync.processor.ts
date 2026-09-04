import { Injectable } from '@nestjs/common';
import { QueueMessage } from '../../../config/rabbitmq.service';
import { SyncService } from '../sync.service';

@Injectable()
export class OrderSyncProcessor {
  constructor(private sync: SyncService) {}

  async process(batch: QueueMessage<{ type: 'ORDERS'; tenantId: string; connectionId: string }>[]) {
    for (const msg of batch) {
      await this.sync.executeSync(msg.payload.type, msg.payload.tenantId, msg.payload.connectionId, msg.correlationId!);
    }
  }
}