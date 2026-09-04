import { z } from 'zod';

export const RoleSchema = z.enum(['owner', 'supervisor', 'employee', 'viewer']);
export type Role = z.infer<typeof RoleSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: RoleSchema,
  avatarUrl: z.string().url().nullable(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastLoginAt: z.date().nullable(),
});
export type User = z.infer<typeof UserSchema>;

export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  logoUrl: z.string().url().nullable(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#3B82F6'),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#64748B'),
  settings: TenantSettingsSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Tenant = z.infer<typeof TenantSchema>;

export const TenantSettingsSchema = z.object({
  boxCodePatterns: z.array(z.string()).default([
    '^BOX-(\\w+)-(\\d+)$',
    '^(\\w{8,12})-(\\d{3,6})$',
  ]),
  defaultCurrency: z.string().length(3).default('ARS'),
  timezone: z.string().default('America/Argentina/Buenos_Aires'),
  lowStockThreshold: z.number().int().positive().default(10),
  enableOpenBox: z.boolean().default(true),
  enableUnlistedProducts: z.boolean().default(true),
  pickingRouteOptimization: z.boolean().default(true),
  requirePhotoOnDamage: z.boolean().default(true),
  sessionTimeoutMinutes: z.number().int().positive().default(480),
});
export type TenantSettings = z.infer<typeof TenantSettingsSchema>;

export const ApiKeySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  hashedKey: z.string(),
  permissions: z.array(z.string()),
  lastUsedAt: z.date().nullable(),
  expiresAt: z.date().nullable(),
  createdAt: z.date(),
});
export type ApiKey = z.infer<typeof ApiKeySchema>;

export const JWTPayloadSchema = z.object({
  sub: z.string().uuid(),
  tenantId: z.string().uuid(),
  email: z.string().email(),
  role: RoleSchema,
  iat: z.number(),
  exp: z.number(),
});
export type JWTPayload = z.infer<typeof JWTPayloadSchema>;

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  rememberMe: z.boolean().optional(),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;