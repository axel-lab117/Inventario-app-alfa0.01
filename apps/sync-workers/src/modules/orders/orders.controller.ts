import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, TenantId, CurrentUser } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrderStatus } from '@repo/shared-types';
import { z } from 'zod';

const CreateOrderDto = z.object({
  customer: z.object({ email: z.string().email(), name: z.string(), phone: z.string().optional() }),
  shippingAddress: z.object({ street: z.string(), number: z.string().optional(), city: z.string(), state: z.string(), postalCode: z.string(), country: z.string().length(2).default('AR') }),
  billingAddress: z.object({ street: z.string(), number: z.string().optional(), city: z.string(), state: z.string(), postalCode: z.string(), country: z.string().length(2).default('AR') }).optional(),
  items: z.array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().positive(), unitPrice: z.number().nonnegative() })).min(1),
  tax: z.number().nonnegative().default(0),
  shipping: z.number().nonnegative().default(0),
  discount: z.number().nonnegative().default(0),
  currency: z.string().length(3).default('ARS'),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

const UpdateStatusDto = z.object({
  status: z.nativeEnum(OrderStatus),
});

const CompletePickingDto = z.object({
  items: z.array(z.object({ taskItemId: z.string().uuid(), pickedQuantity: z.number().int().nonnegative() })).min(1),
});

const PackOrderDto = z.object({
  items: z.array(z.object({ orderItemId: z.string().uuid(), packedQuantity: z.number().int().positive(), trackingNumber: z.string().optional() })).min(1),
});

const ShipOrderDto = z.object({
  trackingNumber: z.string().min(1),
  carrier: z.string().min(1),
});

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Get()
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE', 'VIEWER')
  @ApiOperation({ summary: 'Listar órdenes' })
  async findAll(
    @TenantId() tenantId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.orders.findAll(tenantId, {
      page: Number(page),
      limit: Number(limit),
      status,
      source,
      search,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('stats')
  @Roles('OWNER', 'SUPERVISOR', 'VIEWER')
  @ApiOperation({ summary: 'Estadísticas de órdenes' })
  async getStats(@TenantId() tenantId: string) {
    return this.orders.getOrderStats(tenantId);
  }

  @Get(':id')
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE', 'VIEWER')
  @ApiOperation({ summary: 'Obtener orden por ID' })
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.orders.findOne(tenantId, id);
  }

  @Post()
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Crear orden manual' })
  async createManual(@TenantId() tenantId: string, @Body() body: z.infer<typeof CreateOrderDto>, @CurrentUser('id') userId: string) {
    return this.orders.createManual(tenantId, body, userId);
  }

  @Patch(':id/status')
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE')
  @ApiOperation({ summary: 'Actualizar estado de orden' })
  async updateStatus(@TenantId() tenantId: string, @Param('id') id: string, @Body() body: z.infer<typeof UpdateStatusDto>, @CurrentUser('id') userId: string) {
    return this.orders.updateStatus(tenantId, id, body.status, userId);
  }

  @Post(':id/picking')
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE')
  @ApiOperation({ summary: 'Crear tarea de picking' })
  async createPickingTask(@TenantId() tenantId: string, @Param('id') orderId: string, @CurrentUser('id') userId: string) {
    return this.orders.createPickingTask(tenantId, orderId, userId);
  }

  @Get('picking/tasks')
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE', 'VIEWER')
  @ApiOperation({ summary: 'Listar tareas de picking' })
  async getPickingTasks(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.orders.getPickingTasks(tenantId, { status, assignedTo, page: Number(page), limit: Number(limit) });
  }

  @Patch('picking/:taskId/complete')
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE')
  @ApiOperation({ summary: 'Completar tarea de picking' })
  async completePickingTask(@TenantId() tenantId: string, @Param('taskId') taskId: string, @Body() body: z.infer<typeof CompletePickingDto>) {
    return this.orders.completePickingTask(tenantId, taskId, body.items);
  }

  @Patch(':id/pack')
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE')
  @ApiOperation({ summary: 'Empacar orden' })
  async packOrder(@TenantId() tenantId: string, @Param('id') orderId: string, @Body() body: z.infer<typeof PackOrderDto>) {
    return this.orders.packOrder(tenantId, orderId, body);
  }

  @Patch(':id/ship')
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Marcar como enviado' })
  async shipOrder(@TenantId() tenantId: string, @Param('id') orderId: string, @Body() body: z.infer<typeof ShipOrderDto>) {
    return this.orders.shipOrder(tenantId, orderId, body.trackingNumber, body.carrier);
  }
}