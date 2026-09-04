import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, TenantId, CurrentUser } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WarehouseService } from './warehouse.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { z } from 'zod';

const CreateMapDto = z.object({
  name: z.string().min(1),
  svgContent: z.string(),
  viewBox: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
  scale: z.number().positive().default(1),
  zones: z.array(z.object({
    name: z.string().min(1),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    path: z.string(),
    locationIds: z.array(z.string().uuid()).default([]),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })).default([]),
});

const CreateLocationDto = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(128),
  type: z.enum(['ZONE', 'AISLE', 'RACK', 'SHELF', 'BIN', 'VIRTUAL']),
  parentId: z.string().uuid().nullable().optional(),
  capacity: z.number().int().nonnegative().optional(),
  dimensions: z.object({ l: z.number(), w: z.number(), h: z.number() }).optional(),
  coordinates: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional(),
});

const UpdateSettingsDto = z.object({
  defaultZoneColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  showGrid: z.boolean().optional(),
  gridSize: z.number().int().positive().optional(),
  snapToGrid: z.boolean().optional(),
  defaultBinCapacity: z.number().int().positive().optional(),
  enable3DView: z.boolean().optional(),
});

@ApiTags('warehouse')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('warehouse')
export class WarehouseController {
  constructor(private warehouse: WarehouseService) {}

  @Get('maps')
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE', 'VIEWER')
  @ApiOperation({ summary: 'Listar mapas de galpón' })
  async getMaps(@TenantId() tenantId: string) {
    return this.warehouse.getMaps(tenantId);
  }

  @Get('maps/:mapId')
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE', 'VIEWER')
  @ApiOperation({ summary: 'Obtener mapa con zonas' })
  async getMap(@TenantId() tenantId: string, @Param('mapId') mapId: string) {
    return this.warehouse.getMap(tenantId, mapId);
  }

  @Post('maps')
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Crear mapa de galpón' })
  async createMap(@TenantId() tenantId: string, @Body() body: z.infer<typeof CreateMapDto>) {
    return this.warehouse.createMap(tenantId, body);
  }

  @Patch('maps/:mapId')
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Actualizar mapa' })
  async updateMap(@TenantId() tenantId: string, @Param('mapId') mapId: string, @Body() body: z.infer<typeof CreateMapDto>.partial()) {
    return this.warehouse.updateMap(tenantId, mapId, body);
  }

  @Delete('maps/:mapId')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Eliminar mapa' })
  async deleteMap(@TenantId() tenantId: string, @Param('mapId') mapId: string) {
    return this.warehouse.deleteMap(tenantId, mapId);
  }

  @Get('locations')
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE', 'VIEWER')
  @ApiOperation({ summary: 'Listar ubicaciones' })
  async getLocations(
    @TenantId() tenantId: string,
    @Query('mapId') mapId?: string,
    @Query('type') type?: string,
    @Query('parentId') parentId?: string,
    @Query('search') search?: string,
  ) {
    return this.warehouse.getLocations(tenantId, { mapId, type, parentId, search });
  }

  @Get('locations/tree')
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE', 'VIEWER')
  @ApiOperation({ summary: 'Árbol jerárquico de ubicaciones' })
  async getLocationTree(@TenantId() tenantId: string) {
    return this.warehouse.getLocationTree(tenantId);
  }

  @Post('locations')
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Crear ubicación' })
  async createLocation(@TenantId() tenantId: string, @Body() body: z.infer<typeof CreateLocationDto>) {
    return this.warehouse.createLocation(tenantId, body);
  }

  @Patch('locations/:locationId')
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Actualizar ubicación' })
  async updateLocation(@TenantId() tenantId: string, @Param('locationId') locationId: string, @Body() body: z.infer<typeof CreateLocationDto>.partial()) {
    return this.warehouse.updateLocation(tenantId, locationId, body);
  }

  @Delete('locations/:locationId')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Eliminar ubicación' })
  async deleteLocation(@TenantId() tenantId: string, @Param('locationId') locationId: string) {
    return this.warehouse.deleteLocation(tenantId, locationId);
  }

  @Get('occupancy')
  @Roles('OWNER', 'SUPERVISOR', 'VIEWER')
  @ApiOperation({ summary: 'Ocupación de bins (heatmap)' })
  async getOccupancy(@TenantId() tenantId: string, @Query('mapId') mapId?: string) {
    return this.warehouse.getOccupancy(tenantId, mapId);
  }

  @Post('routes/picking')
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Generar ruta de picking para órdenes' })
  async getPickingRoute(@TenantId() tenantId: string, @Body() body: { orderIds: string[] }) {
    return this.warehouse.getPickingRoute(tenantId, body.orderIds);
  }

  @Get('routes/picking')
  @Roles('OWNER', 'SUPERVISOR', 'VIEWER')
  @ApiOperation({ summary: 'Listar rutas de picking' })
  async getPickingRoutes(@TenantId() tenantId: string, @Query('status') status?: string) {
    return this.warehouse.getPickingRoutes(tenantId, status);
  }

  @Patch('routes/picking/:routeId/start')
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE')
  @ApiOperation({ summary: 'Iniciar ruta de picking' })
  async startPickingRoute(@TenantId() tenantId: string, @Param('routeId') routeId: string, @CurrentUser('id') employeeId: string) {
    return this.warehouse.startPickingRoute(tenantId, routeId, employeeId);
  }

  @Patch('routes/picking/:routeId/complete')
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE')
  @ApiOperation({ summary: 'Completar ruta de picking' })
  async completePickingRoute(@TenantId() tenantId: string, @Param('routeId') routeId: string) {
    return this.warehouse.completePickingRoute(tenantId, routeId);
  }

  @Get('settings')
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Configuración de galpón' })
  async getSettings(@TenantId() tenantId: string) {
    return this.warehouse.getSettings(tenantId);
  }

  @Patch('settings')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Actualizar configuración' })
  async updateSettings(@TenantId() tenantId: string, @Body() body: z.infer<typeof UpdateSettingsDto>) {
    return this.warehouse.updateSettings(tenantId, body);
  }
}