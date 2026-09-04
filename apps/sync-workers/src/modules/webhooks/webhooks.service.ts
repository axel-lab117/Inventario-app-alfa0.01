import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RabbitMQService } from '../../config/rabbitmq.service';
import { createAdapter } from '@repo/marketplace-adapters';
import { Marketplace, WebhookEvent } from '@repo/shared-types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WebhooksService {
  constructor(private prisma: PrismaService, private rabbitmq: RabbitMQService) {}

  async handleMercadoLibre(tenantId: string, connectionId: string, payload: any, headers: Record<string, string>, signature: string) {
    return this.processWebhook(tenantId, connectionId, 'MERCADOLIBRE', payload, headers, signature);
  }

  async handleFravega(tenantId: string, connectionId: string, payload: any, headers: Record<string, string>, signature: string) {
    return this.processWebhook(tenantId, connectionId, 'FRAVEGA', payload, headers, signature);
  }

  async handleGarbarino(tenantId: string, connectionId: string, payload: any, headers: Record<string, string>, signature: string) {
    return this.processWebhook(tenantId, connectionId, 'GARBARINO', payload, headers, signature);
  }

  async handleMegatone(tenantId: string, connectionId: string, payload: any, headers: Record<string, string>, signature: string) {
    return this.processWebhook(tenantId, connectionId, 'MEGATONE', payload, headers, signature);
  }

  async handleShopify(tenantId: string, connectionId: string, payload: any, headers: Record<string, string>, signature: string) {
    return this.processWebhook(tenantId, connectionId, 'SHOPIFY', payload, headers, signature);
  }

  async handleTiendanube(tenantId: string, connectionId: string, payload: any, headers: Record<string, string>, signature: string) {
    return this.processWebhook(tenantId, connectionId, 'TIENDANUBE', payload, headers, signature);
  }

  private async processWebhook(
    tenantId: string,
    connectionId: string,
    marketplace: Marketplace,
    payload: any,
    headers: Record<string, string>,
    signature: string
  ) {
    const conn = await this.prisma.marketplaceConnection.findFirst({ where: { id: connectionId, tenantId } });
    if (!conn) throw new BadRequestException('Conexión no encontrada');

    const adapter = createAdapter(marketplace);
    if (!adapter) throw new BadRequestException('Marketplace no soportado');

    const webhookSecret = conn.webhookSecret;
    if (webhookSecret && !adapter.verifyWebhook(JSON.stringify(payload), signature, webhookSecret)) {
      throw new BadRequestException('Firma de webhook inválida');
    }

    const eventType = this.extractEventType(marketplace, payload, headers);
    const resourceType = this.extractResourceType(marketplace, payload);
    const resourceId = this.extractResourceId(marketplace, payload);

    const idempotencyKey = `${marketplace}:${eventType}:${resourceId}:${Date.now()}`;

    const existing = await this.prisma.webhookEvent.findUnique({ where: { idempotencyKey } });
    if (existing) return { success: true, duplicate: true };

    await this.prisma.webhookEvent.create({
      data: {
        tenantId,
        connectionId,
        marketplace,
        eventType,
        resourceType,
        resourceId,
        payload,
        headers,
        idempotencyKey,
      },
    });

    await this.rabbitmq.publish('webhook.process', {
      tenantId,
      connectionId,
      marketplace,
      eventType,
      resourceType,
      resourceId,
      payload,
      idempotencyKey,
    });

    return { success: true };
  }

  private extractEventType(marketplace: Marketplace, payload: any, headers: Record<string, string>): string {
    switch (marketplace) {
      case 'MERCADOLIBRE':
        return headers['x-ml-topic'] || payload.topic || 'unknown';
      case 'SHOPIFY':
        return headers['x-shopify-topic'] || 'unknown';
      case 'TIENDANUBE':
        return payload.event || 'unknown';
      default:
        return payload.event_type || payload.type || 'unknown';
    }
  }

  private extractResourceType(marketplace: Marketplace, payload: any): string {
    switch (marketplace) {
      case 'MERCADOLIBRE':
        return payload.resource?.split('/')[0] || 'unknown';
      case 'SHOPIFY':
        return payload.resource_type || 'unknown';
      default:
        return payload.resource_type || 'unknown';
    }
  }

  private extractResourceId(marketplace: Marketplace, payload: any): string {
    switch (marketplace) {
      case 'MERCADOLIBRE':
        return payload.resource?.split('/').pop() || payload.resource_id || 'unknown';
      case 'SHOPIFY':
        return payload.resource_id || payload.id || 'unknown';
      default:
        return payload.resource_id || payload.id || 'unknown';
    }
  }

  async processQueuedWebhook(data: { tenantId: string; connectionId: string; marketplace: Marketplace; eventType: string; resourceType: string; resourceId: string; payload: any; idempotencyKey: string }) {
    const { tenantId, connectionId, marketplace, eventType, resourceType, resourceId, payload } = data;

    try {
      switch (resourceType) {
        case 'orders':
        case 'order':
          await this.handleOrderWebhook(tenantId, connectionId, marketplace, eventType, payload);
          break;
        case 'items':
        case 'item':
        case 'products':
        case 'product':
          await this.handleProductWebhook(tenantId, connectionId, marketplace, eventType, payload);
          break;
        case 'stock':
        case 'inventory':
          await this.handleStockWebhook(tenantId, connectionId, marketplace, eventType, payload);
          break;
        case 'shipments':
        case 'shipment':
          await this.handleShipmentWebhook(tenantId, connectionId, marketplace, eventType, payload);
          break;
        case 'questions':
        case 'question':
          await this.handleQuestionWebhook(tenantId, connectionId, marketplace, eventType, payload);
          break;
      }

      await this.prisma.webhookEvent.update({
        where: { idempotencyKey: data.idempotencyKey },
        data: { processed: true, processedAt: new Date() },
      });

    } catch (error) {
      await this.prisma.webhookEvent.update({
        where: { idempotencyKey: data.idempotencyKey },
        data: { processed: true, processedAt: new Date(), error: error.message },
      });
      throw error;
    }
  }

  private async handleOrderWebhook(tenantId: string, connectionId: string, marketplace: Marketplace, eventType: string, payload: any) {
    if (eventType.includes('created') || eventType.includes('new')) {
      const adapter = createAdapter(marketplace);
      if (adapter) {
        const order = await adapter.fetchOrderDetails(payload.resource_id || payload.id);
        // Import logic here
      }
    } else if (eventType.includes('status_changed') || eventType.includes('updated')) {
      // Update order status
    }
  }

  private async handleProductWebhook(tenantId: string, connectionId: string, marketplace: Marketplace, eventType: string, payload: any) {
    // Handle product updates from marketplace
  }

  private async handleStockWebhook(tenantId: string, connectionId: string, marketplace: Marketplace, eventType: string, payload: any) {
    // Handle stock updates from marketplace
  }

  private async handleShipmentWebhook(tenantId: string, connectionId: string, marketplace: Marketplace, eventType: string, payload: any) {
    // Handle shipment updates
  }

  private async handleQuestionWebhook(tenantId: string, connectionId: string, marketplace: Marketplace, eventType: string, payload: any) {
    // Handle customer questions
  }
}