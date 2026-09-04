import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

export interface QueueMessage<T = any> {
  type: string;
  payload: T;
  timestamp: number;
  correlationId?: string;
  tenantId?: string;
}

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private readonly url: string;
  private readonly queues = {
    sync: 'wms.sync',
    webhook: 'wms.webhook',
    stock: 'wms.stock',
    orders: 'wms.orders',
    notifications: 'wms.notifications',
    audit: 'wms.audit',
    deadLetter: 'wms.dlq',
  };

  constructor(private config: ConfigService) {
    this.url = config.get('RABBITMQ_URL') || 'amqp://wms:wms_secret@localhost:5672/wms';
  }

  async onModuleInit() {
    await this.connect();
    await this.setupTopology();
  }

  async onModuleDestroy() {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
  }

  private async connect() {
    this.connection = await amqp.connect(this.url, {
      heartbeat: 30,
      connectionTimeout: 10000,
    });

    this.connection.on('error', (err) => console.error('RabbitMQ Connection Error:', err));
    this.connection.on('close', () => console.log('RabbitMQ Connection Closed'));

    this.channel = await this.connection.createChannel();
    this.channel.on('error', (err) => console.error('RabbitMQ Channel Error:', err));
    this.channel.on('close', () => console.log('RabbitMQ Channel Closed'));

    await this.channel.prefetch(10);
  }

  private async setupTopology() {
    if (!this.channel) return;

    const exchanges = [
      { name: 'wms.events', type: 'topic', durable: true },
      { name: 'wms.commands', type: 'direct', durable: true },
      { name: 'wms.dlx', type: 'direct', durable: true },
    ];

    for (const exchange of exchanges) {
      await this.channel.assertExchange(exchange.name, exchange.type, { durable: exchange.durable });
    }

    const queueConfigs = [
      { name: this.queues.sync, exchange: 'wms.commands', routingKey: 'sync.*' },
      { name: this.queues.webhook, exchange: 'wms.commands', routingKey: 'webhook.*' },
      { name: this.queues.stock, exchange: 'wms.events', routingKey: 'stock.*' },
      { name: this.queues.orders, exchange: 'wms.events', routingKey: 'order.*' },
      { name: this.queues.notifications, exchange: 'wms.events', routingKey: 'notification.*' },
      { name: this.queues.audit, exchange: 'wms.events', routingKey: 'audit.*' },
      { name: this.queues.deadLetter, exchange: 'wms.dlx', routingKey: 'dead' },
    ];

    for (const config of queueConfigs) {
      await this.channel.assertQueue(config.name, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'wms.dlx',
          'x-dead-letter-routing-key': 'dead',
          'x-message-ttl': 86400000,
        },
      });
      await this.channel.bindQueue(config.name, config.exchange, config.routingKey);
    }
  }

  async publish<T>(routingKey: string, message: Omit<QueueMessage<T>, 'timestamp'>): Promise<boolean> {
    if (!this.channel) throw new Error('RabbitMQ channel not initialized');

    const fullMessage: QueueMessage<T> = {
      ...message,
      timestamp: Date.now(),
    };

    return this.channel.publish('wms.commands', routingKey, Buffer.from(JSON.stringify(fullMessage)), {
      persistent: true,
      contentType: 'application/json',
      messageId: message.correlationId || crypto.randomUUID(),
      timestamp: fullMessage.timestamp,
    });
  }

  async publishEvent<T>(routingKey: string, message: Omit<QueueMessage<T>, 'timestamp'>): Promise<boolean> {
    if (!this.channel) throw new Error('RabbitMQ channel not initialized');

    const fullMessage: QueueMessage<T> = {
      ...message,
      timestamp: Date.now(),
    };

    return this.channel.publish('wms.events', routingKey, Buffer.from(JSON.stringify(fullMessage)), {
      persistent: true,
      contentType: 'application/json',
      messageId: message.correlationId || crypto.randomUUID(),
      timestamp: fullMessage.timestamp,
    });
  }

  async consume<T>(queue: string, handler: (message: QueueMessage<T>) => Promise<void>): Promise<void> {
    if (!this.channel) throw new Error('RabbitMQ channel not initialized');

    await this.channel.consume(queue, async (msg) => {
      if (!msg) return;

      try {
        const content = JSON.parse(msg.content.toString()) as QueueMessage<T>;
        await handler(content);
        this.channel!.ack(msg);
      } catch (error) {
        console.error(`Error processing message from ${queue}:`, error);
        this.channel!.nack(msg, false, false);
      }
    });
  }

  async consumeBatch<T>(
    queue: string,
    handler: (messages: QueueMessage<T>[]) => Promise<void>,
    batchSize = 10,
    batchTimeoutMs = 5000
  ): Promise<void> {
    if (!this.channel) throw new Error('RabbitMQ channel not initialized');

    const buffer: QueueMessage<T>[] = [];
    let flushTimeout: NodeJS.Timeout;

    const flush = async () => {
      if (buffer.length > 0) {
        const batch = buffer.splice(0, buffer.length);
        try {
          await handler(batch);
          buffer.forEach(() => this.channel!.ack(msg)); // Note: this needs proper msg tracking
        } catch (error) {
          console.error(`Batch processing error for ${queue}:`, error);
        }
      }
      flushTimeout = setTimeout(flush, batchTimeoutMs);
    };

    await this.channel.consume(queue, async (msg) => {
      if (!msg) return;
      const content = JSON.parse(msg.content.toString()) as QueueMessage<T>;
      buffer.push(content);
      if (buffer.length >= batchSize) {
        clearTimeout(flushTimeout);
        await flush();
      }
    });
  }

  getChannel(): amqp.Channel | null {
    return this.channel;
  }

  isConnected(): boolean {
    return this.connection !== null && this.channel !== null;
  }
}