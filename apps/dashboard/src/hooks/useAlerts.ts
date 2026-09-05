'use client';

import { z } from 'zod';
import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  StockAlertRuleSchema,
  AlertEventSchema,
  NotificationSettingsSchema,
  CreateAlertRuleDtoSchema,
  UpdateAlertRuleDtoSchema,
  AcknowledgeAlertDtoSchema,
  AlertConditionEnum,
  AlertSeverityEnum,
  AlertChannelEnum,
  type StockAlertRule,
  type AlertEvent,
  type NotificationSettings,
  type CreateAlertRuleDto,
  type UpdateAlertRuleDto,
  type AcknowledgeAlertDto,
  type AlertCondition,
  type AlertSeverity,
  type AlertChannel,
} from '@repo/shared-types/alerts';

const alertRulesResponseSchema = z.array(StockAlertRuleSchema);
const alertRuleResponseSchema = StockAlertRuleSchema;
const alertEventsResponseSchema = z.array(AlertEventSchema);
const notificationSettingsResponseSchema = NotificationSettingsSchema;

export function useAlertRules(
  options?: UseQueryOptions<StockAlertRule[], Error>
) {
  return useQuery({
    queryKey: ['alert-rules'],
    queryFn: async () => {
      const response = await api.get('/alerts/rules');
      return alertRulesResponseSchema.parse(response.data);
    },
    ...options,
  });
}

export function useAlertRule(
  id: string,
  options?: UseQueryOptions<StockAlertRule, Error>
) {
  return useQuery({
    queryKey: ['alert-rule', id],
    queryFn: async () => {
      const response = await api.get(`/alerts/rules/${id}`);
      return alertRuleResponseSchema.parse(response.data);
    },
    enabled: !!id,
    ...options,
  });
}

export function useAlertEvents(
  params: { ruleId?: string; acknowledged?: boolean; severity?: AlertSeverity; limit?: number; offset?: number } = {},
  options?: UseQueryOptions<AlertEvent[], Error>
) {
  return useQuery({
    queryKey: ['alert-events', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value));
        }
      });
      const response = await api.get(`/alerts/events?${searchParams.toString()}`);
      return alertEventsResponseSchema.parse(response.data);
    },
    ...options,
  });
}

export function useUnacknowledgedAlertsCount(
  options?: UseQueryOptions<number, Error>
) {
  return useQuery({
    queryKey: ['alert-events', 'unacknowledged-count'],
    queryFn: async () => {
      const response = await api.get('/alerts/events/unacknowledged/count');
      return response.data.count as number;
    },
    refetchInterval: 30000,
    ...options,
  });
}

export function useNotificationSettings(
  options?: UseQueryOptions<NotificationSettings, Error>
) {
  return useQuery({
    queryKey: ['notification-settings'],
    queryFn: async () => {
      const response = await api.get('/alerts/notification-settings');
      return notificationSettingsResponseSchema.parse(response.data);
    },
    ...options,
  });
}

export function useCreateAlertRule(
  options?: UseMutationOptions<StockAlertRule, Error, CreateAlertRuleDto>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto) => {
      const parsed = CreateAlertRuleDtoSchema.parse(dto);
      const response = await api.post('/alerts/rules', parsed);
      return alertRuleResponseSchema.parse(response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
    },
    ...options,
  });
}

export function useUpdateAlertRule(
  options?: UseMutationOptions<StockAlertRule, Error, { id: string; data: UpdateAlertRuleDto }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const parsed = UpdateAlertRuleDtoSchema.parse(data);
      const response = await api.put(`/alerts/rules/${id}`, parsed);
      return alertRuleResponseSchema.parse(response.data);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
      queryClient.invalidateQueries({ queryKey: ['alert-rule', id] });
    },
    ...options,
  });
}

export function useDeleteAlertRule(
  options?: UseMutationOptions<void, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      await api.delete(`/alerts/rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
    },
    ...options,
  });
}

export function useAcknowledgeAlert(
  options?: UseMutationOptions<void, Error, AcknowledgeAlertDto>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto) => {
      const parsed = AcknowledgeAlertDtoSchema.parse(dto);
      await api.post('/alerts/events/acknowledge', parsed);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-events'] });
      queryClient.invalidateQueries({ queryKey: ['alert-events', 'unacknowledged-count'] });
    },
    ...options,
  });
}

export function useBulkAcknowledgeAlerts(
  options?: UseMutationOptions<void, Error, { alertEventIds: string[]; snoozeMinutes?: number }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ alertEventIds, snoozeMinutes }) => {
      await api.post('/alerts/events/bulk-acknowledge', { alertEventIds, snoozeMinutes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-events'] });
      queryClient.invalidateQueries({ queryKey: ['alert-events', 'unacknowledged-count'] });
    },
    ...options,
  });
}

export function useUpdateNotificationSettings(
  options?: UseMutationOptions<NotificationSettings, Error, Partial<NotificationSettings>>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      const response = await api.put('/alerts/notification-settings', data);
      return notificationSettingsResponseSchema.parse(response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
    },
    ...options,
  });
}

export const ALERT_CONDITIONS: { value: AlertCondition; label: string; description: string; unit: string }[] = [
  { value: 'BELOW_THRESHOLD', label: 'Stock por debajo de umbral', description: 'Se dispara cuando el stock disponible cae por debajo de la cantidad configurada', unit: 'QUANTITY' },
  { value: 'ZERO_STOCK', label: 'Stock en cero', description: 'Se dispara cuando el stock llega a 0 unidades', unit: 'QUANTITY' },
  { value: 'DAYS_IN_STOCK_EXCEEDS', label: 'Días en stock excedidos', description: 'Se dispara cuando un lote lleva más días del configurado sin movimiento', unit: 'DAYS' },
  { value: 'NO_MOVEMENT_DAYS', label: 'Sin movimiento por días', description: 'Se dispara cuando no hay movimientos de entrada/salida en X días', unit: 'DAYS' },
  { value: 'OCCUPANCY_EXCEEDS', label: 'Ocupación de ubicación excedida', description: 'Se dispara cuando la ocupación de un bin/ubicación supera el porcentaje', unit: 'PERCENT' },
  { value: 'TEMPERATURE_EXCEEDS', label: 'Temperatura excedida', description: 'Se dispara cuando la temperatura supera el límite (requiere sensores IoT)', unit: 'CELSIUS' },
  { value: 'HUMIDITY_EXCEEDS', label: 'Humedad excedida', description: 'Se dispara cuando la humedad supera el límite (requiere sensores IoT)', unit: 'PERCENT_HUMIDITY' },
];

export const ALERT_SEVERITIES: { value: AlertSeverity; label: string; color: string; bgColor: string }[] = [
  { value: 'INFO', label: 'Informativo', color: 'text-primary-700', bgColor: 'bg-primary-100' },
  { value: 'WARNING', label: 'Advertencia', color: 'text-warning-700', bgColor: 'bg-warning-100' },
  { value: 'CRITICAL', label: 'Crítico', color: 'text-danger-700', bgColor: 'bg-danger-100' },
];

export const ALERT_CHANNELS: { value: AlertChannel; label: string; icon: string; description: string }[] = [
  { value: 'IN_APP', label: 'En la app', icon: '🔔', description: 'Notificación en el centro de alertas' },
  { value: 'EMAIL', label: 'Email', icon: '📧', description: 'Envío a correos configurados' },
  { value: 'PUSH', label: 'Push', icon: '📱', description: 'Notificación push en móvil/escritorio' },
  { value: 'WEBHOOK', label: 'Webhook', icon: '🔗', description: 'POST a URL externa (Slack, Teams, etc.)' },
  { value: 'SMS', label: 'SMS', icon: '💬', description: 'Mensaje de texto (requiere proveedor)' },
];