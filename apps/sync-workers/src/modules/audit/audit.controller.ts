import { Controller, Get, Query, Param, ParseUUIDPipe } from '@nestjs/common';
import { AuditService } from './audit.service';
import { CurrentTenant } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';

@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get('stock/:variantId/:locationId')
  async getStockHistory(
    @CurrentTenant('id') tenantId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();
    return this.audit.getStockHistory(tenantId, variantId, locationId, fromDate, toDate);
  }

  @Get('orders/:orderId')
  async getOrderHistory(
    @CurrentTenant('id') tenantId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.audit.getOrderHistory(tenantId, orderId);
  }

  @Get('sync/:connectionId')
  async getSyncHistory(
    @CurrentTenant('id') tenantId: string,
    @Param('connectionId', ParseUUIDPipe) connectionId: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.getSyncHistory(tenantId, connectionId, limit ? parseInt(limit) : 100);
  }
}