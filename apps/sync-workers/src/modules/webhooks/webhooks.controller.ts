import { Controller, Post, Get, Param, Query, Body, Headers, Req, UseGuards, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { Marketplace } from '@repo/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private webhooks: WebhooksService,
    @Inject(PrismaService) private prisma: PrismaService,
  ) {}

  @Post('mercadolibre')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook MercadoLibre' })
  async mercadoLibre(
    @Req() req: any,
    @Headers('x-signature') signature: string,
    @Headers() headers: Record<string, string>,
  ) {
    const tenantId = req.headers['x-tenant-id'];
    const connectionId = req.headers['x-connection-id'];
    return this.webhooks.handleMercadoLibre(tenantId, connectionId, req.body, headers, signature);
  }

  @Post('fravega')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook Frávega' })
  async fravega(
    @Req() req: any,
    @Headers('x-signature') signature: string,
    @Headers() headers: Record<string, string>,
  ) {
    const tenantId = req.headers['x-tenant-id'];
    const connectionId = req.headers['x-connection-id'];
    return this.webhooks.handleFravega(tenantId, connectionId, req.body, headers, signature);
  }

  @Post('garbarino')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook Garbarino' })
  async garbarino(
    @Req() req: any,
    @Headers('x-signature') signature: string,
    @Headers() headers: Record<string, string>,
  ) {
    const tenantId = req.headers['x-tenant-id'];
    const connectionId = req.headers['x-connection-id'];
    return this.webhooks.handleGarbarino(tenantId, connectionId, req.body, headers, signature);
  }

  @Post('megatone')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook Megatone' })
  async megatone(
    @Req() req: any,
    @Headers('x-signature') signature: string,
    @Headers() headers: Record<string, string>,
  ) {
    const tenantId = req.headers['x-tenant-id'];
    const connectionId = req.headers['x-connection-id'];
    return this.webhooks.handleMegatone(tenantId, connectionId, req.body, headers, signature);
  }

  @Post('shopify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook Shopify' })
  async shopify(
    @Req() req: any,
    @Headers('x-shopify-hmac-sha256') signature: string,
    @Headers() headers: Record<string, string>,
  ) {
    const tenantId = req.headers['x-tenant-id'];
    const connectionId = req.headers['x-connection-id'];
    return this.webhooks.handleShopify(tenantId, connectionId, req.body, headers, signature);
  }

  @Post('tiendanube')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook Tiendanube' })
  async tiendanube(
    @Req() req: any,
    @Headers('x-tiendanube-hmac-sha256') signature: string,
    @Headers() headers: Record<string, string>,
  ) {
    const tenantId = req.headers['x-tenant-id'];
    const connectionId = req.headers['x-connection-id'];
    return this.webhooks.handleTiendanube(tenantId, connectionId, req.body, headers, signature);
  }

  @Get('events')
  @ApiOperation({ summary: 'Listar eventos de webhook' })
  async getEvents(
    @Query('tenantId') tenantId: string,
    @Query('connectionId') connectionId?: string,
    @Query('processed') processed?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    const where: any = { tenantId };
    if (connectionId) where.connectionId = connectionId;
    if (processed !== undefined) where.processed = processed === 'true';

    const [events, total] = await Promise.all([
      this.prisma.webhookEvent.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.webhookEvent.count({ where }),
    ]);

    return { events, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}