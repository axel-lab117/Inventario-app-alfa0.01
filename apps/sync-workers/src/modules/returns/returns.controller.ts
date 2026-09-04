import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, TenantId, CurrentUser } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReturnsService } from './returns.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReturnStatus, ProductCondition } from '@repo/shared-types';
import { z } from 'zod';

const ReceiveDto = z.object({
  conditionOnReceipt: z.string().min(1),
  images: z.array(z.string().url()).default([]),
  restockLocationId: z.string().uuid(),
});

const InspectDto = z.object({
  resolution: z.enum(['RESTOCK', 'OPEN_BOX', 'DAMAGE', 'DISPOSE']),
  targetCondition: z.enum(['OPEN_BOX_A', 'OPEN_BOX_B', 'OPEN_BOX_C']).optional(),
  refundAmount: z.number().nonnegative().optional(),
});

@ApiTags('returns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('returns')
export class ReturnsController {
  constructor(private returns: ReturnsService) {}

  @Get()
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE', 'VIEWER')
  @ApiOperation({ summary: 'Listar devoluciones' })
  async findAll(
    @TenantId() tenantId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.returns.findAll(tenantId, {
      page: Number(page),
      limit: Number(limit),
      status,
      source,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('stats')
  @Roles('OWNER', 'SUPERVISOR', 'VIEWER')
  @ApiOperation({ summary: 'Estadísticas de devoluciones' })
  async getStats(@TenantId() tenantId: string) {
    return this.returns.getReturnStats(tenantId);
  }

  @Get(':id')
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE', 'VIEWER')
  @ApiOperation({ summary: 'Obtener devolución por ID' })
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.returns.findOne(tenantId, id);
  }

  @Patch(':id/authorize')
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Autorizar devolución' })
  async authorize(@TenantId() tenantId: string, @Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.returns.authorize(tenantId, id, userId);
  }

  @Patch(':id/receive')
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE')
  @ApiOperation({ summary: 'Recibir devolución en almacén' })
  async receive(@TenantId() tenantId: string, @Param('id') id: string, @Body() body: z.infer<typeof ReceiveDto>, @CurrentUser('id') userId: string) {
    return this.returns.receive(tenantId, id, body, userId);
  }

  @Patch(':id/inspect')
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Inspeccionar y resolver devolución' })
  async inspect(@TenantId() tenantId: string, @Param('id') id: string, @Body() body: z.infer<typeof InspectDto>, @CurrentUser('id') userId: string) {
    return this.returns.inspect(tenantId, id, body, userId);
  }
}