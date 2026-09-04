import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, TenantId, CurrentUser } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { z } from 'zod';

const AdjustStockDto = z.object({
  variantId: z.string().uuid(),
  locationId: z.string().uuid(),
  newQuantity: z.number().int().nonnegative(),
  reason: z.string().min(1),
});

const MoveStockDto = z.object({
  variantId: z.string().uuid(),
  fromLocationId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  quantity: z.number().int().positive(),
  reason: z.string().optional(),
});

const ReserveStockDto = z.object({
  variantId: z.string().uuid(),
  locationId: z.string().uuid(),
  quantity: z.number().int().positive(),
  referenceId: z.string().uuid(),
  referenceType: z.string(),
});

const ProcessRemovalDto = z.object({
  boxCode: z.string().min(1),
  locationId: z.string().uuid(),
  idempotencyKey: z.string().min(1),
});

const ProcessReturnDto = z.object({
  boxCode: z.string().min(1),
  locationId: z.string().uuid(),
  condition: z.enum(['NEW', 'OPEN_BOX_A', 'OPEN_BOX_B', 'OPEN_BOX_C', 'DAMAGED', 'REFURBISHED']),
  idempotencyKey: z.string().min(1),
  reason: z.string().optional(),
});

const ConvertOpenBoxDto = z.object({
  variantId: z.string().uuid(),
  locationId: z.string().uuid(),
  targetCondition: z.enum(['OPEN_BOX_A', 'OPEN_BOX_B', 'OPEN_BOX_C']),
  quantity: z.number().int().positive(),
  reason: z.string().optional(),
});

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private inventory: InventoryService) {}

  @Get('levels')
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE', 'VIEWER')
  @ApiOperation({ summary: 'Listar niveles de stock' })
  async getStockLevels(
    @TenantId() tenantId: string,
    @Query('variantId') variantId?: string,
    @Query('locationId') locationId?: string,
    @Query('lowStock') lowStock?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.inventory.getStockLevels(tenantId, {
      variantId,
      locationId,
      lowStock: lowStock === 'true',
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Get('levels/:variantId/:locationId')
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE', 'VIEWER')
  @ApiOperation({ summary: 'Obtener stock de una variante en ubicación' })
  async getStockLevel(
    @TenantId() tenantId: string,
    @Param('variantId') variantId: string,
    @Param('locationId') locationId: string,
  ) {
    return this.inventory.getStockLevel(tenantId, variantId, locationId);
  }

  @Get('available/:variantId')
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE', 'VIEWER')
  @ApiOperation({ summary: 'Stock disponible total de una variante' })
  async getAvailableStock(@TenantId() tenantId: string, @Param('variantId') variantId: string) {
    const total = await this.inventory.getAvailableStock(tenantId, variantId);
    return { variantId, totalAvailable: total };
  }

  @Post('adjust')
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Ajuste de inventario (conteo físico)' })
  async adjustStock(
    @TenantId() tenantId: string,
    @Body() body: z.infer<typeof AdjustStockDto>,
    @CurrentUser('id') employeeId: string,
  ) {
    return this.inventory.adjustStock(tenantId, { ...body, employeeId });
  }

  @Post('move')
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE')
  @ApiOperation({ summary: 'Transferir stock entre ubicaciones' })
  async moveStock(
    @TenantId() tenantId: string,
    @Body() body: z.infer<typeof MoveStockDto>,
    @CurrentUser('id') employeeId: string,
  ) {
    return this.inventory.moveStock(tenantId, { ...body, employeeId });
  }

  @Post('reserve')
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Reservar stock para orden' })
  async reserveStock(
    @TenantId() tenantId: string,
    @Body() body: z.infer<typeof ReserveStockDto>,
  ) {
    return this.inventory.reserveStock(tenantId, body.variantId, body.locationId, body.quantity, body.referenceId, body.referenceType);
  }

  @Post('release')
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Liberar reserva de stock' })
  async releaseReservation(
    @TenantId() tenantId: string,
    @Body() body: z.object({ variantId: z.string().uuid(), locationId: z.string().uuid(), quantity: z.number().int().positive() }),
  ) {
    return this.inventory.releaseReservation(tenantId, body.variantId, body.locationId, body.quantity);
  }

  @Post('scan/remove')
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE')
  @ApiOperation({ summary: 'Procesar retiro de caja (scanner empleado)' })
  async processRemoval(
    @TenantId() tenantId: string,
    @Body() body: z.infer<typeof ProcessRemovalDto>,
    @CurrentUser('id') employeeId: string,
  ) {
    return this.inventory.processRemoval(tenantId, { ...body, employeeId });
  }

  @Post('scan/return')
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE')
  @ApiOperation({ summary: 'Procesar devolución de caja (scanner empleado)' })
  async processReturn(
    @TenantId() tenantId: string,
    @Body() body: z.infer<typeof ProcessReturnDto>,
    @CurrentUser('id') employeeId: string,
  ) {
    return this.inventory.processReturn(tenantId, { ...body, employeeId });
  }

  @Post('convert/open-box')
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Convertir stock a Open Box' })
  async convertToOpenBox(
    @TenantId() tenantId: string,
    @Body() body: z.infer<typeof ConvertOpenBoxDto>,
    @CurrentUser('id') employeeId: string,
  ) {
    return this.inventory.convertToOpenBox(tenantId, { ...body, employeeId });
  }

  @Get('movements')
  @Roles('OWNER', 'SUPERVISOR', 'VIEWER')
  @ApiOperation({ summary: 'Historial de movimientos' })
  async getMovements(
    @TenantId() tenantId: string,
    @Query('variantId') variantId?: string,
    @Query('locationId') locationId?: string,
    @Query('type') type?: string,
    @Query('employeeId') employeeId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.inventory.getMovements(tenantId, {
      variantId,
      locationId,
      type,
      employeeId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: Number(page),
      limit: Number(limit),
    });
  }
}