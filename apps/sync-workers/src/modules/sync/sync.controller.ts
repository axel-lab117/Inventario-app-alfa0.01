import { Controller, Get, Post, Body, Param, Query, UseGuards, TenantId } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SyncType } from '@repo/shared-types';
import { z } from 'zod';

const SyncDto = z.object({
  type: z.nativeEnum(SyncType),
  connectionId: z.string().uuid(),
});

@ApiTags('sync')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sync')
export class SyncController {
  constructor(private sync: SyncService) {}

  @Post('execute')
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Ejecutar sincronización manual' })
  async executeSync(@TenantId() tenantId: string, @Body() body: z.infer<typeof SyncDto>) {
    const correlationId = require('uuid').v4();
    await this.sync.executeSync(body.type, tenantId, body.connectionId, correlationId);
    return { success: true, correlationId };
  }

  @Get('logs')
  @Roles('OWNER', 'SUPERVISOR', 'VIEWER')
  @ApiOperation({ summary: 'Logs de sincronización globales' })
  async getLogs(
    @TenantId() tenantId: string,
    @Query('connectionId') connectionId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    const where: any = { tenantId };
    if (connectionId) where.connectionId = connectionId;
    if (type) where.type = type;
    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      this.prisma.syncLog.findMany({
        where,
        include: { connection: { select: { name: true, marketplace: true } } },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.syncLog.count({ where }),
    ]);

    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}