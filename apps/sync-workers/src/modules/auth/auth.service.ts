import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return null;

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;

    return user;
  }

  async login(email: string, password: string, rememberMe = false) {
    const user = await this.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.generateTokens(user, rememberMe);
  }

  async register(data: { email: string; password: string; name: string; tenantName: string; tenantSlug: string }) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) throw new ConflictException('Email ya registrado');

    const existingTenant = await this.prisma.tenant.findUnique({ where: { slug: data.tenantSlug } });
    if (existingTenant) throw new ConflictException('Slug de tenant ya existe');

    const passwordHash = await bcrypt.hash(data.password, 12);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: data.tenantName,
        slug: data.tenantSlug,
        settings: {},
      },
    });

    const user = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: data.email,
        passwordHash,
        name: data.name,
        role: 'OWNER',
      },
    });

    return this.generateTokens(user, false);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET') || this.config.get('JWT_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { tenant: true },
      });

      if (!user || !user.isActive) throw new UnauthorizedException('Usuario inactivo');

      return this.generateTokens(user, false);
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }
  }

  async logout(userId: string) {
    // Optionally blacklist refresh token
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    return user;
  }

  private generateTokens(user: any, rememberMe: boolean) {
    const accessToken = this.jwt.sign(
      { sub: user.id, tenantId: user.tenantId, email: user.email, role: user.role },
      { expiresIn: rememberMe ? '30d' : '15m' },
    );

    const refreshToken = this.jwt.sign(
      { sub: user.id, type: 'refresh' },
      {
        secret: this.config.get('JWT_REFRESH_SECRET') || this.config.get('JWT_SECRET'),
        expiresIn: rememberMe ? '90d' : '7d',
      },
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        tenantName: user.tenant?.name,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: rememberMe ? 30 * 24 * 60 * 60 : 15 * 60,
      },
    };
  }
}