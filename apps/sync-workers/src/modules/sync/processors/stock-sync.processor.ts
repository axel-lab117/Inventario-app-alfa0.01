import { Injectable } from '@nestjs/common';
import { RabbitMQService, QueueMessage } from '../../../config/rabbitmq.service';
import { SyncService } from '../sync.service';

@Injectable()
export class StockSyncProcessor {
  constructor(private rabbitmq: RabbitMQService, private sync: SyncService) {}

  async process(batch: QueueMessage<{ type: 'STOCK'; tenantId: string; connectionId: string }>[]) {
    for (const msg of batch) {
      await this.sync.executeSync(msg.payload.type, msg.payload.tenantId, msg.payload.connectionId, msg.correlationId!);
    }
  }
}