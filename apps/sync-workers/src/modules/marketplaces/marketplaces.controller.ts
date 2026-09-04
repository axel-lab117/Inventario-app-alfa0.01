import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, TenantId, CurrentUser } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MarketplacesService } from './marketplaces.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Marketplace } from '@repo/shared-types';
import { z } from 'zod';

const CreateConnectionDto = z.object({
  marketplace: z.nativeEnum(Marketplace),
  name: z.string().min(1),
  credentials: z.record(z.string(), z.string()),
  settings: z.object({
    autoImportOrders: z.boolean().default(true),
    autoSyncStock: z.boolean().default(true),
    autoSyncPrice: z.boolean().default(false),
    defaultCondition: z.string().default('NEW'),
    defaultListingStatus: z.string().default('LISTED'),
    skuMapping: z.record(z.string(), z.string()).default({}),
    warehouseMapping: z.record(z.string(), z.string()).default({}),
    ignoredOrderStatuses: z.array(z.string()).default([]),
    customFields: z.record(z.string(), z.unknown()).default({}),
  }).optional(),
});

const SyncDto = z.object({
  types: z.array(z.enum(['STOCK', 'PRICE', 'ORDERS', 'PRODUCTS', 'FULL'])).default(['STOCK', 'ORDERS']),
});

@ApiTags('marketplaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('marketplaces')
export class MarketplacesController {
  constructor(private marketplaces: MarketplacesService) {}

  @Get()
  @Roles('OWNER', 'SUPERVISOR', 'VIEWER')
  @ApiOperation({ summary: 'Listar conexiones de marketplaces' })
  async findAll(@TenantId() tenantId: string) {
    return this.marketplaces.findAll(tenantId);
  }

  @Get(':id')
  @Roles('OWNER', 'SUPERVISOR', 'VIEWER')
  @ApiOperation({ summary: 'Obtener conexión con logs recientes' })
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.marketplaces.findOne(tenantId, id);
  }

  @Post()
  @Roles('OWNER')
  @ApiOperation({ summary: 'Crear conexión marketplace' })
  async create(@TenantId() tenantId: string, @Body() body: z.infer<typeof CreateConnectionDto>, @CurrentUser('role') role: string) {
    return this.marketplaces.create(tenantId, body, role);
  }

  @Patch(':id')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Actualizar conexión' })
  async update(@TenantId() tenantId: string, @Param('id') id: string, @Body() body: z.infer<typeof CreateConnectionDto>.partial(), @CurrentUser('role') role: string) {
    return this.marketplaces.update(tenantId, id, body, role);
  }

  @Delete(':id')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Eliminar conexión' })
  async delete(@TenantId() tenantId: string, @Param('id') id: string, @CurrentUser('role') role: string) {
    return this.marketplaces.delete(tenantId, id, role);
  }

  @Post(':id/test')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Probar conexión' })
  async test(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.marketplaces.testConnection(tenantId, id);
  }

  @Post(':id/sync')
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Ejecutar sincronización manual' })
  async syncNow(@TenantId() tenantId: string, @Param('id') id: string, @Body() body: z.infer<typeof SyncDto>) {
    return this.marketplaces.syncNow(tenantId, id, body.types);
  }

  @Get(':id/products')
  @Roles('OWNER', 'SUPERVISOR', 'VIEWER')
  @ApiOperation({ summary: 'Productos del marketplace' })
  async getProducts(
    @TenantId() tenantId: string,
    @Param('id') connectionId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('search') search?: string,
  ) {
    return this.marketplaces.getProducts(tenantId, connectionId, { page: Number(page), limit: Number(limit), search });
  }

  @Patch(':id/products/:productId/link')
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Vincular producto local' })
  async linkProduct(@TenantId() tenantId: string, @Param('id') connectionId: string, @Param('productId') marketplaceProductId: string, @Body() body: { localVariantId: string }) {
    return this.marketplaces.linkProduct(tenantId, connectionId, marketplaceProductId, body.localVariantId);
  }

  @Patch(':id/products/:productId/unlink')
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Desvincular producto' })
  async unlinkProduct(@TenantId() tenantId: string, @Param('id') connectionId: string, @Param('productId') marketplaceProductId: string) {
    return this.marketplaces.unlinkProduct(tenantId, connectionId, marketplaceProductId);
  }

  @Get(':id/logs')
  @Roles('OWNER', 'SUPERVISOR', 'VIEWER')
  @ApiOperation({ summary: 'Logs de sincronización' })
  async getLogs(@TenantId() tenantId: string, @Param('id') connectionId: string, @Query('limit') limit = 50) {
    return this.marketplaces.getSyncLogs(tenantId, connectionId, Number(limit));
  }
}