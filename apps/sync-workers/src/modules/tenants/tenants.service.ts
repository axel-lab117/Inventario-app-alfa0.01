import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantSettingsSchema } from '@repo/shared-types';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async findCurrent(tenantId: string) {
    return this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: {
          select: { users: true, products: true, orders: true, locations: true },
        },
      },
    });
  }

  async updateSettings(tenantId: string, settings: Partial<any>, userRole: string) {
    if (userRole !== 'OWNER') throw new ForbiddenException('Solo el owner puede modificar configuración');

    const parsed = TenantSettingsSchema.partial().safeParse(settings);
    if (!parsed.success) throw new Error('Configuración inválida: ' + parsed.error.message);

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: parsed.data },
    });
  }

  async updateBranding(tenantId: string, data: { name?: string; logoUrl?: string; primaryColor?: string; secondaryColor?: string }, userRole: string) {
    if (userRole !== 'OWNER') throw new ForbiddenException('Solo el owner puede modificar branding');

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data,
    });
  }

  async getUsers(tenantId: string, page = 1, limit = 20) {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, email: true, name: true, role: true, avatarUrl: true, isActive: true, lastLoginAt: true, createdAt: true },
      }),
      this.prisma.user.count({ where: { tenantId } }),
    ]);

    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async inviteUser(tenantId: string, data: { email: string; name: string; role: string }, inviterRole: string) {
    if (inviterRole !== 'OWNER' && inviterRole !== 'SUPERVISOR') throw new ForbiddenException('Sin permisos');

    if (data.role === 'OWNER' && inviterRole !== 'OWNER') throw new ForbiddenException('Solo owner puede crear owners');

    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new Error('Usuario ya existe');

    const tempPassword = Math.random().toString(36).slice(-12);
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    return this.prisma.user.create({
      data: {
        tenantId,
        email: data.email,
        name: data.name,
        role: data.role as any,
        passwordHash,
        isActive: true,
      },
    });
  }

  async updateUser(tenantId: string, userId: string, data: { name?: string; role?: string; isActive?: boolean }, updaterRole: string) {
    const target = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!target) throw new NotFoundException('Usuario no encontrado');

    if (target.role === 'OWNER' && updaterRole !== 'OWNER') throw new ForbiddenException('No puede modificar owner');
    if (data.role === 'OWNER' && updaterRole !== 'OWNER') throw new ForbiddenException('Solo owner puede asignar rol owner');

    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async deleteUser(tenantId: string, userId: string, deleterRole: string) {
    const target = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!target) throw new NotFoundException('Usuario no encontrado');

    if (target.role === 'OWNER') throw new ForbiddenException('No puede eliminar owner');
    if (deleterRole !== 'OWNER' && deleterRole !== 'SUPERVISOR') throw new ForbiddenException('Sin permisos');

    return this.prisma.user.delete({ where: { id: userId } });
  }
}