import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const tenantSlug = req.headers['x-tenant-slug'] as string;
    const tenantId = req.headers['x-tenant-id'] as string;

    if (tenantId) {
      PrismaService.setTenantId(tenantId);
      (req as any).tenantId = tenantId;
    } else if (tenantSlug) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        select: { id: true },
      });
      if (tenant) {
        PrismaService.setTenantId(tenant.id);
        (req as any).tenantId = tenant.id;
      }
    }

    next();
  }
}