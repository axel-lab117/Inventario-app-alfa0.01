import { Controller, Get, Patch, Post, Delete, Body, Param, Query, UseGuards, CurrentUser, TenantId } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@repo/shared-types';
import { z } from 'zod';

const UpdateSettingsDto = z.object({
  boxCodePatterns: z.array(z.string()).optional(),
  defaultCurrency: z.string().length(3).optional(),
  timezone: z.string().optional(),
  lowStockThreshold: z.number().int().positive().optional(),
  enableOpenBox: z.boolean().optional(),
  enableUnlistedProducts: z.boolean().optional(),
  pickingRouteOptimization: z.boolean().optional(),
  requirePhotoOnDamage: z.boolean().optional(),
  sessionTimeoutMinutes: z.number().int().positive().optional(),
});

const UpdateBrandingDto = z.object({
  name: z.string().min(1).optional(),
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const InviteUserDto = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: z.enum(['SUPERVISOR', 'EMPLOYEE', 'VIEWER']),
});

const UpdateUserDto = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(['SUPERVISOR', 'EMPLOYEE', 'VIEWER']).optional(),
  isActive: z.boolean().optional(),
});

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private tenants: TenantsService) {}

  @Get()
  @Roles('OWNER', 'SUPERVISOR', 'VIEWER')
  @ApiOperation({ summary: 'Obtener tenant actual' })
  async getCurrent(@TenantId() tenantId: string) {
    return this.tenants.findCurrent(tenantId);
  }

  @Patch('settings')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Actualizar configuración del tenant' })
  async updateSettings(@TenantId() tenantId: string, @Body() body: z.infer<typeof UpdateSettingsDto>, @CurrentUser('role') role: string) {
    return this.tenants.updateSettings(tenantId, body, role);
  }

  @Patch('branding')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Actualizar branding' })
  async updateBranding(@TenantId() tenantId: string, @Body() body: z.infer<typeof UpdateBrandingDto>, @CurrentUser('role') role: string) {
    return this.tenants.updateBranding(tenantId, body, role);
  }

  @Get('users')
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Listar usuarios del tenant' })
  async getUsers(@TenantId() tenantId: string, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.tenants.getUsers(tenantId, Number(page), Number(limit));
  }

  @Post('users')
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Invitar usuario' })
  async inviteUser(@TenantId() tenantId: string, @Body() body: z.infer<typeof InviteUserDto>, @CurrentUser('role') role: string) {
    return this.tenants.inviteUser(tenantId, body, role);
  }

  @Patch('users/:userId')
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Actualizar usuario' })
  async updateUser(@TenantId() tenantId: string, @Param('userId') userId: string, @Body() body: z.infer<typeof UpdateUserDto>, @CurrentUser('role') role: string) {
    return this.tenants.updateUser(tenantId, userId, body, role);
  }

  @Delete('users/:userId')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Eliminar usuario' })
  async deleteUser(@TenantId() tenantId: string, @Param('userId') userId: string, @CurrentUser('role') role: string) {
    return this.tenants.deleteUser(tenantId, userId, role);
  }
}