import { z } from 'zod';

export const AlertConditionEnum = z.enum([
  'BELOW_THRESHOLD',
  'ZERO_STOCK',
  'DAYS_IN_STOCK_EXCEEDS',
  'NO_MOVEMENT_DAYS',
  'OCCUPANCY_EXCEEDS',
  'TEMPERATURE_EXCEEDS',
  'HUMIDITY_EXCEEDS',
]);

export const AlertSeverityEnum = z.enum([
  'INFO',
  'WARNING',
  'CRITICAL',
]);

export const AlertChannelEnum = z.enum([
  'IN_APP',
  'EMAIL',
  'PUSH',
  'WEBHOOK',
  'SMS',
]);

export const StockAlertRuleSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  variantId: z.string().uuid().nullable(),
  locationId: z.string().uuid().nullable(),
  zoneId: z.string().uuid().nullable(),
  condition: AlertConditionEnum,
  threshold: z.number(),
  thresholdUnit: z.enum(['QUANTITY', 'DAYS', 'PERCENT', 'CELSIUS', 'PERCENT_HUMIDITY']).default('QUANTITY'),
  severity: AlertSeverityEnum,
  channels: z.array(AlertChannelEnum).default(['IN_APP']),
  recipients: z.array(z.string().uuid()).default([]),
  cooldownMinutes: z.number().int().positive().default(60),
  isActive: z.boolean().default(true),
  createdById: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type StockAlertRule = z.infer<typeof StockAlertRuleSchema>;

export const AlertEventSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  ruleId: z.string().uuid(),
  rule: StockAlertRuleSchema.optional(),
  variantId: z.string().uuid().nullable(),
  locationId: z.string().uuid().nullable(),
  zoneId: z.string().uuid().nullable(),
  currentValue: z.number(),
  threshold: z.number(),
  severity: AlertSeverityEnum,
  message: z.string(),
  acknowledged: z.boolean().default(false),
  acknowledgedById: z.string().uuid().nullable(),
  acknowledgedAt: z.date().nullable(),
  snoozedUntil: z.date().nullable(),
  createdAt: z.date(),
});
export type AlertEvent = z.infer<typeof AlertEventSchema>;

export const NotificationSettingsSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  emailEnabled: z.boolean().default(true),
  pushEnabled: z.boolean().default(true),
  inAppEnabled: z.boolean().default(true),
  smsEnabled: z.boolean().default(false),
  webhookUrl: z.string().url().nullable(),
  webhookSecret: z.string().nullable(),
  quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).nullable(),
  quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).nullable(),
  timezone: z.string().default('America/Argentina/Buenos_Aires'),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;

export const CreateAlertRuleDtoSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  variantId: z.string().uuid().nullable().optional(),
  locationId: z.string().uuid().nullable().optional(),
  zoneId: z.string().uuid().nullable().optional(),
  condition: AlertConditionEnum,
  threshold: z.number(),
  thresholdUnit: z.enum(['QUANTITY', 'DAYS', 'PERCENT', 'CELSIUS', 'PERCENT_HUMIDITY']).default('QUANTITY'),
  severity: AlertSeverityEnum,
  channels: z.array(AlertChannelEnum).default(['IN_APP']),
  recipients: z.array(z.string().uuid()).default([]),
  cooldownMinutes: z.number().int().positive().default(60),
});

export const UpdateAlertRuleDtoSchema = CreateAlertRuleDtoSchema.partial();

export const AcknowledgeAlertDtoSchema = z.object({
  alertEventId: z.string().uuid(),
  snoozeMinutes: z.number().int().positive().optional(),
});

export type AlertCondition = z.infer<typeof AlertConditionEnum>;
export type AlertSeverity = z.infer<typeof AlertSeverityEnum>;
export type AlertChannel = z.infer<typeof AlertChannelEnum>;
export type CreateAlertRuleDto = z.infer<typeof CreateAlertRuleDtoSchema>;
export type UpdateAlertRuleDto = z.infer<typeof UpdateAlertRuleDtoSchema>;
export type AcknowledgeAlertDto = z.infer<typeof AcknowledgeAlertDtoSchema>;