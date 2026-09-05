'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Bell, Plus, Edit, Trash2, Save, Filter, Search, ChevronDown,
  CheckCircle, AlertTriangle, XCircle, Info, Mail, Smartphone,
  Link2, MessageSquare, Clock, RotateCcw, Eye, EyeOff,
  BellOff, Settings, RefreshCw, Loader2
} from 'lucide-react';
import {
  Card, CardHeader, CardBody, Input, Button, Badge,
  Dropdown, Modal, Tabs, TabsList, TabsTrigger, TabsContent,
  Tooltip, Switch, Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Label, Textarea
} from '@repo/ui/components';
import { useToast } from '@repo/ui/components';
import {
  useAlertRules,
  useAlertEvents,
  useUnacknowledgedAlertsCount,
  useNotificationSettings,
  useCreateAlertRule,
  useUpdateAlertRule,
  useDeleteAlertRule,
  useAcknowledgeAlert,
  useBulkAcknowledgeAlerts,
  useUpdateNotificationSettings,
  ALERT_CONDITIONS,
  ALERT_SEVERITIES,
  ALERT_CHANNELS,
  type StockAlertRule,
  type AlertEvent,
  type NotificationSettings,
  type CreateAlertRuleDto,
  type UpdateAlertRuleDto,
  type AlertCondition,
  type AlertSeverity,
  type AlertChannel,
} from '@/hooks/useAlerts';

const SEVERITY_ORDER = { CRITICAL: 0, WARNING: 1, INFO: 2 };

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatRelativeTime(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Ahora mismo';
  if (minutes < 60) return `Hace ${minutes} min`;
  if (hours < 24) return `Hace ${hours} h`;
  return `Hace ${days} d`;
}

function getSeverityConfig(severity: AlertSeverity) {
  return ALERT_SEVERITIES.find(s => s.value === severity) || ALERT_SEVERITIES[0];
}

function getConditionLabel(condition: AlertCondition) {
  return ALERT_CONDITIONS.find(c => c.value === condition)?.label || condition;
}

export default function AlertsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'center' | 'rules' | 'settings'>('center');
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all');
  const [ackFilter, setAckFilter] = useState<'all' | 'ack' | 'unack'>('unack');
  const [search, setSearch] = useState('');
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<StockAlertRule | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const { data: rules = [], isLoading: rulesLoading, refetch: refetchRules } = useAlertRules();
  const { data: events = [], isLoading: eventsLoading, refetch: refetchEvents } = useAlertEvents({ 
    acknowledged: ackFilter === 'ack' ? true : ackFilter === 'unack' ? false : undefined,
    severity: severityFilter !== 'all' ? severityFilter : undefined,
    limit: 100,
  });
  const { data: unackCount, refetch: refetchUnackCount } = useUnacknowledgedAlertsCount();
  const { data: notifSettings, isLoading: notifLoading } = useNotificationSettings();

  const createRuleMutation = useCreateAlertRule();
  const updateRuleMutation = useUpdateAlertRule();
  const deleteRuleMutation = useDeleteAlertRule();
  const acknowledgeMutation = useAcknowledgeAlert();
  const bulkAcknowledgeMutation = useBulkAcknowledgeAlerts();
  const updateNotifMutation = useUpdateNotificationSettings();

  const filteredEvents = events.filter(e => {
    if (search) {
      const searchLower = search.toLowerCase();
      if (!e.message.toLowerCase().includes(searchLower) &&
          !e.rule?.name.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    return true;
  }).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const handleCreateRule = async (formData: FormData) => {
    try {
      await createRuleMutation.mutateAsync({
        name: formData.get('name') as string,
        description: formData.get('description') as string || undefined,
        variantId: formData.get('variantId') as string || null,
        locationId: formData.get('locationId') as string || null,
        zoneId: formData.get('zoneId') as string || null,
        condition: formData.get('condition') as AlertCondition,
        threshold: parseFloat(formData.get('threshold') as string),
        thresholdUnit: formData.get('thresholdUnit') as any,
        severity: formData.get('severity') as AlertSeverity,
        channels: JSON.parse(formData.get('channels') as string || '["IN_APP"]'),
        recipients: JSON.parse(formData.get('recipients') as string || '[]'),
        cooldownMinutes: parseInt(formData.get('cooldownMinutes') as string || '60'),
      });
      toast({ title: 'Regla creada', type: 'success' });
      setShowRuleModal(false);
      setEditingRule(null);
      refetchRules();
    } catch (err) {
      toast({ title: 'Error creando regla', description: err instanceof Error ? err.message : 'Error', type: 'error' });
    }
  };

  const handleUpdateRule = async (formData: FormData) => {
    if (!editingRule) return;
    try {
      await updateRuleMutation.mutateAsync({
        id: editingRule.id,
        data: {
          name: formData.get('name') as string,
          description: formData.get('description') as string || undefined,
          variantId: formData.get('variantId') as string || null,
          locationId: formData.get('locationId') as string || null,
          zoneId: formData.get('zoneId') as string || null,
          condition: formData.get('condition') as AlertCondition,
          threshold: parseFloat(formData.get('threshold') as string),
          thresholdUnit: formData.get('thresholdUnit') as any,
          severity: formData.get('severity') as AlertSeverity,
          channels: JSON.parse(formData.get('channels') as string || '["IN_APP"]'),
          recipients: JSON.parse(formData.get('recipients') as string || '[]'),
          cooldownMinutes: parseInt(formData.get('cooldownMinutes') as string || '60'),
          isActive: formData.get('isActive') === 'on',
        },
      });
      toast({ title: 'Regla actualizada', type: 'success' });
      setShowRuleModal(false);
      setEditingRule(null);
      refetchRules();
    } catch (err) {
      toast({ title: 'Error actualizando', description: err instanceof Error ? err.message : 'Error', type: 'error' });
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('¿Eliminar esta regla de alerta?')) return;
    try {
      await deleteRuleMutation.mutateAsync(id);
      toast({ title: 'Regla eliminada', type: 'success' });
      refetchRules();
    } catch (err) {
      toast({ title: 'Error eliminando', description: err instanceof Error ? err.message : 'Error', type: 'error' });
    }
  };

  const handleAcknowledge = async (eventId: string, snoozeMinutes?: number) => {
    try {
      await acknowledgeMutation.mutateAsync({ alertEventId: eventId, snoozeMinutes });
      toast({ title: snoozeMinutes ? `Pospuesta ${snoozeMinutes} min` : 'Confirmada', type: 'success' });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error', type: 'error' });
    }
  };

  const handleBulkAcknowledge = async () => {
    if (selectedEvents.length === 0) return;
    try {
      await bulkAcknowledgeMutation.mutateAsync({ alertEventIds: selectedEvents });
      toast({ title: `${selectedEvents.length} alertas confirmadas`, type: 'success' });
      setSelectedEvents([]);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error', type: 'error' });
    }
  };

  const handleNotifChange = async (key: string, value: any) => {
    try {
      await updateNotifMutation.mutateAsync({ [key]: value });
    } catch (err) {
      toast({ title: 'Error guardando', description: err instanceof Error ? err.message : 'Error', type: 'error' });
    }
  };

  const openCreateRule = () => {
    setEditingRule(null);
    setShowRuleModal(true);
  };

  const openEditRule = (rule: StockAlertRule) => {
    setEditingRule(rule);
    setShowRuleModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 flex items-center gap-3">
            <Bell className="h-8 w-8 text-primary-600" />
            Centro de Alertas
          </h1>
          <p className="mt-1 text-surface-500">Gestiona reglas, visualiza alertas y configura notificaciones</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => { refetchEvents(); refetchUnackCount(); }} disabled={eventsLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${eventsLoading ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
          {activeTab === 'rules' && (
            <Button onClick={openCreateRule} disabled={createRuleMutation.isPending}>
              <Plus className="h-4 w-4 mr-2" /> Nueva Regla
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-4 border-b border-surface-200">
        {[
          { id: 'center', label: 'Centro de Alertas', icon: Bell, badge: unackCount },
          { id: 'rules', label: 'Reglas', icon: Settings, badge: rules.length },
          { id: 'settings', label: 'Notificaciones', icon: BellOff },
        ].map(tab => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'primary' : 'ghost'}
            className="flex-1 gap-2"
            onClick={() => setActiveTab(tab.id as any)}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.badge !== undefined && (
              <Badge variant={tab.id === 'center' && tab.badge > 0 ? 'danger' : 'neutral'}>
                {tab.badge}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {activeTab === 'center' && (
        <AlertCenter
          events={filteredEvents}
          isLoading={eventsLoading}
          severityFilter={severityFilter}
          setSeverityFilter={setSeverityFilter}
          ackFilter={ackFilter}
          setAckFilter={setAckFilter}
          search={search}
          setSearch={setSearch}
          selectedEvents={selectedEvents}
          setSelectedEvents={setSelectedEvents}
          onAcknowledge={handleAcknowledge}
          onBulkAcknowledge={handleBulkAcknowledge}
          acknowledgeMutation={acknowledgeMutation}
        />
      )}

      {activeTab === 'rules' && (
        <RulesManager
          rules={rules}
          isLoading={rulesLoading}
          onCreate={openCreateRule}
          onEdit={openEditRule}
          onDelete={handleDeleteRule}
          createMutation={createRuleMutation}
          updateMutation={updateRuleMutation}
          deleteMutation={deleteRuleMutation}
        />
      )}

      {activeTab === 'settings' && (
        <NotificationSettingsPanel
          settings={notifSettings}
          isLoading={notifLoading}
          onChange={handleNotifChange}
          updateMutation={updateNotifMutation}
        />
      )}

      <RuleModal
        isOpen={showRuleModal}
        onClose={() => { setShowRuleModal(false); setEditingRule(null); }}
        editingRule={editingRule}
        onSubmit={editingRule ? handleUpdateRule : handleCreateRule}
        createMutation={createRuleMutation}
        updateMutation={updateRuleMutation}
      />
    </div>
  );
}

function AlertCenter({
  events,
  isLoading,
  severityFilter,
  setSeverityFilter,
  ackFilter,
  setAckFilter,
  search,
  setSearch,
  selectedEvents,
  setSelectedEvents,
  onAcknowledge,
  onBulkAcknowledge,
  acknowledgeMutation,
}: {
  events: AlertEvent[];
  isLoading: boolean;
  severityFilter: AlertSeverity | 'all';
  setSeverityFilter: (v: AlertSeverity | 'all') => void;
  ackFilter: 'all' | 'ack' | 'unack';
  setAckFilter: (v: 'all' | 'ack' | 'unack') => void;
  search: string;
  setSearch: (v: string) => void;
  selectedEvents: string[];
  setSelectedEvents: (v: string[]) => void;
  onAcknowledge: (id: string, snooze?: number) => void;
  onBulkAcknowledge: () => void;
  acknowledgeMutation: ReturnType<typeof useAcknowledgeAlert>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
            <Input
              placeholder="Buscar en alertas..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Dropdown
            trigger={<Button variant="outline"><Filter className="h-4 w-4 mr-2" /> Severidad</Button>}
            items={[
              { label: 'Todas', value: 'all' },
              { label: 'Críticas', value: 'CRITICAL' },
              { label: 'Advertencias', value: 'WARNING' },
              { label: 'Informativas', value: 'INFO' },
            ]}
            onSelect={setSeverityFilter}
            selectedValue={severityFilter}
          />
          <Dropdown
            trigger={<Button variant="outline"><Filter className="h-4 w-4 mr-2" /> Estado</Button>}
            items={[
              { label: 'Todas', value: 'all' },
              { label: 'Sin confirmar', value: 'unack' },
              { label: 'Confirmadas', value: 'ack' },
            ]}
            onSelect={setAckFilter}
            selectedValue={ackFilter}
          />
        </div>
        {selectedEvents.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-surface-600">{selectedEvents.length} seleccionadas</span>
            <Button variant="outline" size="sm" onClick={onBulkAcknowledge} disabled={acknowledgeMutation.isPending}>
              <CheckCircle className="h-4 w-4 mr-2" /> Confirmar seleccionadas
            </Button>
          </div>
        )}
      </CardHeader>

      <CardBody className="p-0">
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500 mx-auto mb-2" />
            <p className="text-surface-500">Cargando alertas...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="h-16 w-16 mx-auto mb-4 text-surface-300" />
            <h3 className="text-lg font-medium text-surface-700">No hay alertas</h3>
            <p className="text-surface-500 mt-1">¡Todo tranquilo por ahora!</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100 max-h-[70vh] overflow-y-auto">
            {events.map(event => {
              const severityConfig = getSeverityConfig(event.severity);
              const isSnoozed = event.snoozedUntil && new Date(event.snoozedUntil) > new Date();
              return (
                <div
                  key={event.id}
                  className={`p-4 hover:bg-surface-50 transition-colors ${event.acknowledged ? 'opacity-60 bg-surface-50' : ''} ${isSnoozed ? 'bg-warning-50' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(event.id)}
                      onChange={e => setSelectedEvents(prev => e.target.checked ? [...prev, event.id] : prev.filter(id => id !== event.id))}
                      className="mt-1 h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityConfig.bgColor} ${severityConfig.color}`}>
                              {severityConfig.label}
                            </span>
                            <span className="text-sm text-surface-500">{formatRelativeTime(event.createdAt)}</span>
                            {event.rule && (
                              <Badge variant="neutral" className="text-xs">{event.rule.name}</Badge>
                            )}
                            {isSnoozed && (
                              <Badge variant="warning" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" /> Pospuesta
                              </Badge>
                            )}
                          </div>
                          <p className="text-surface-900 font-medium">{event.message}</p>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-surface-500">
                            {event.variantId && <span>Variante: {event.variantId.slice(0, 8)}...</span>}
                            {event.locationId && <span>Ubicación: {event.locationId.slice(0, 8)}...</span>}
                            {event.zoneId && <span>Zona: {event.zoneId.slice(0, 8)}...</span>}
                            <span>Valor: {event.currentValue} / Umbral: {event.threshold}</span>
                          </div>
                        </div>
                        {!event.acknowledged && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Tooltip content="Confirmar">
                              <Button variant="ghost" size="sm" onClick={() => onAcknowledge(event.id)}>
                                <CheckCircle className="h-4 w-4 text-success-600" />
                              </Button>
                            </Tooltip>
                            <Tooltip content="Posponer 1 hora">
                              <Button variant="ghost" size="sm" onClick={() => onAcknowledge(event.id, 60)}>
                                <Clock className="h-4 w-4 text-warning-600" />
                              </Button>
                            </Tooltip>
                            <Tooltip content="Posponer 8 horas">
                              <Button variant="ghost" size="sm" onClick={() => onAcknowledge(event.id, 480)}>
                                <Clock className="h-4 w-4 text-primary-600" />
                              </Button>
                            </Tooltip>
                            <Tooltip content="Posponer 24 horas">
                              <Button variant="ghost" size="sm" onClick={() => onAcknowledge(event.id, 1440)}>
                                <RotateCcw className="h-4 w-4 text-surface-600" />
                              </Button>
                            </Tooltip>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function RulesManager({
  rules,
  isLoading,
  onCreate,
  onEdit,
  onDelete,
  createMutation,
  updateMutation,
  deleteMutation,
}: {
  rules: StockAlertRule[];
  isLoading: boolean;
  onCreate: () => void;
  onEdit: (rule: StockAlertRule) => void;
  onDelete: (id: string) => void;
  createMutation: ReturnType<typeof useCreateAlertRule>;
  updateMutation: ReturnType<typeof useUpdateAlertRule>;
  deleteMutation: ReturnType<typeof useDeleteAlertRule>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
        <h3 className="font-semibold text-surface-900">Reglas de Alerta</h3>
        <Button onClick={onCreate} disabled={createMutation.isPending}>
          <Plus className="h-4 w-4 mr-2" /> Nueva Regla
        </Button>
      </CardHeader>

      <CardBody className="p-0">
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500 mx-auto mb-2" />
            <p className="text-surface-500">Cargando reglas...</p>
          </div>
        ) : rules.length === 0 ? (
          <div className="p-12 text-center">
            <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-surface-300" />
            <h3 className="text-lg font-medium text-surface-700">No hay reglas configuradas</h3>
            <p className="text-surface-500 mt-1">Crea tu primera regla para empezar a recibir alertas</p>
            <Button className="mt-4" onClick={onCreate}>
              <Plus className="h-4 w-4 mr-2" /> Crear Regla
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-surface-100">
            {rules.map(rule => {
              const severityConfig = getSeverityConfig(rule.severity);
              const condition = ALERT_CONDITIONS.find(c => c.value === rule.condition);
              return (
                <div key={rule.id} className="p-4 hover:bg-surface-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium text-surface-900">{rule.name}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityConfig.bgColor} ${severityConfig.color}`}>
                          {severityConfig.label}
                        </span>
                        <Badge variant={rule.isActive ? 'success' : 'neutral'} className="text-xs">
                          {rule.isActive ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </div>
                      {rule.description && <p className="text-sm text-surface-500 mb-2">{rule.description}</p>}
                      <div className="flex flex-wrap gap-3 text-sm text-surface-600">
                        <span><strong>Condición:</strong> {condition?.label || rule.condition}</span>
                        <span><strong>Umbral:</strong> {rule.threshold} {rule.thresholdUnit}</span>
                        <span><strong>Canales:</strong> {rule.channels.join(', ')}</span>
                        <span><strong>Cooldown:</strong> {rule.cooldownMinutes} min</span>
                        {rule.variantId && <span><strong>Producto:</strong> {rule.variantId.slice(0, 8)}...</span>}
                        {rule.locationId && <span><strong>Ubicación:</strong> {rule.locationId.slice(0, 8)}...</span>}
                        {rule.zoneId && <span><strong>Zona:</strong> {rule.zoneId.slice(0, 8)}...</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Tooltip content="Editar">
                        <Button variant="ghost" size="sm" onClick={() => onEdit(rule)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                      <Tooltip content={rule.isActive ? 'Desactivar' : 'Activar'}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateMutation.mutate({ id: rule.id, data: { isActive: !rule.isActive } })}
                          disabled={updateMutation.isPending}
                        >
                          {rule.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </Tooltip>
                      <Tooltip content="Eliminar">
                        <Button variant="ghost" size="sm" danger onClick={() => onDelete(rule.id)} disabled={deleteMutation.isPending}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function NotificationSettingsPanel({
  settings,
  isLoading,
  onChange,
  updateMutation,
}: {
  settings: NotificationSettings | undefined;
  isLoading: boolean;
  onChange: (key: string, value: any) => void;
  updateMutation: ReturnType<typeof useUpdateNotificationSettings>;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-surface-900 flex items-center gap-2">
            <Bell className="h-5 w-5" /> Canales de Notificación
          </h3>
        </CardHeader>
        <CardBody className="space-y-6">
          {ALERT_CHANNELS.map(channel => (
            <div key={channel.value} className="flex items-center justify-between p-4 bg-surface-50 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{channel.icon}</span>
                <div>
                  <p className="font-medium text-surface-900">{channel.label}</p>
                  <p className="text-sm text-surface-500">{channel.description}</p>
                </div>
              </div>
              <Switch
                checked={settings ? (settings as any)[`${channel.value.toLowerCase()}Enabled`] : false}
                onCheckedChange={checked => onChange(`${channel.value.toLowerCase()}Enabled`, checked)}
                disabled={isLoading || updateMutation.isPending}
              />
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-surface-900 flex items-center gap-2">
            <Clock className="h-5 w-5" /> Horario Silencioso
          </h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quietStart">Inicio</Label>
              <Input
                id="quietStart"
                type="time"
                value={settings?.quietHoursStart || ''}
                onChange={e => onChange('quietHoursStart', e.target.value || null)}
                disabled={isLoading || updateMutation.isPending}
              />
            </div>
            <div>
              <Label htmlFor="quietEnd">Fin</Label>
              <Input
                id="quietEnd"
                type="time"
                value={settings?.quietHoursEnd || ''}
                onChange={e => onChange('quietHoursEnd', e.target.value || null)}
                disabled={isLoading || updateMutation.isPending}
              />
            </div>
          </div>
          <p className="text-sm text-surface-500">
            Las notificaciones no sonarán entre estas horas (zona horaria: {settings?.timezone || 'America/Argentina/Buenos_Aires'})
          </p>
        </CardBody>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <h3 className="font-semibold text-surface-900 flex items-center gap-2">
            <Link2 className="h-5 w-5" /> Webhook Personalizado
          </h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="URL del Webhook"
              placeholder="https://hooks.slack.com/services/... o https://tu-api.com/webhook"
              value={settings?.webhookUrl || ''}
              onChange={e => onChange('webhookUrl', e.target.value || null)}
              disabled={isLoading || updateMutation.isPending}
            />
            <Input
              label="Secreto (opcional)"
              placeholder="Clave secreta para validar payloads"
              type="password"
              value={settings?.webhookSecret || ''}
              onChange={e => onChange('webhookSecret', e.target.value || null)}
              disabled={isLoading || updateMutation.isPending}
            />
          </div>
          <p className="text-sm text-surface-500">
            Se enviará un POST con el payload de la alerta. Incluye headers: <code className="bg-surface-100 px-1 rounded text-xs">X-Alert-Signature</code> (HMAC-SHA256 del body con el secreto).
          </p>
          <Button variant="outline" onClick={() => {
            if (settings?.webhookUrl) {
              fetch(settings.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ test: true, message: 'Test de webhook desde WMS' }),
              }).then(r => toast({ title: r.ok ? 'Webhook OK' : 'Error en webhook', type: r.ok ? 'success' : 'error' }));
            }
          }} disabled={!settings?.webhookUrl || updateMutation.isPending}>
            <RotateCcw className="h-4 w-4 mr-2" /> Probar Webhook
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}

function RuleModal({
  isOpen,
  onClose,
  editingRule,
  onSubmit,
  createMutation,
  updateMutation,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingRule: StockAlertRule | null;
  onSubmit: (formData: FormData) => void;
  createMutation: ReturnType<typeof useCreateAlertRule>;
  updateMutation: ReturnType<typeof useUpdateAlertRule>;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    condition: 'BELOW_THRESHOLD' as AlertCondition,
    threshold: '',
    thresholdUnit: 'QUANTITY',
    severity: 'WARNING' as AlertSeverity,
    channels: ['IN_APP'] as AlertChannel[],
    variantId: '',
    locationId: '',
    zoneId: '',
    cooldownMinutes: '60',
    isActive: true,
  });

  useEffect(() => {
    if (editingRule) {
      setFormData({
        name: editingRule.name,
        description: editingRule.description || '',
        condition: editingRule.condition,
        threshold: String(editingRule.threshold),
        thresholdUnit: editingRule.thresholdUnit,
        severity: editingRule.severity,
        channels: editingRule.channels,
        variantId: editingRule.variantId || '',
        locationId: editingRule.locationId || '',
        zoneId: editingRule.zoneId || '',
        cooldownMinutes: String(editingRule.cooldownMinutes),
        isActive: editingRule.isActive,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        condition: 'BELOW_THRESHOLD',
        threshold: '',
        thresholdUnit: 'QUANTITY',
        severity: 'WARNING',
        channels: ['IN_APP'],
        variantId: '',
        locationId: '',
        zoneId: '',
        cooldownMinutes: '60',
        isActive: true,
      });
    }
  }, [editingRule, isOpen]);

  const handleChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleChannelToggle = (channel: AlertChannel) => {
    handleChange('channels', formData.channels.includes(channel)
      ? formData.channels.filter(c => c !== channel)
      : [...formData.channels, channel]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(formData).forEach(([k, v]) => {
      if (Array.isArray(v)) fd.append(k, JSON.stringify(v));
      else fd.append(k, String(v));
    });
    onSubmit(fd);
  };

  const condition = ALERT_CONDITIONS.find(c => c.value === formData.condition);
  const thresholdUnit = condition?.unit || 'QUANTITY';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingRule ? `Editar Regla: ${editingRule.name}` : 'Nueva Regla de Alerta'}
      description={editingRule ? 'Modifica la configuración de la regla' : 'Define cuándo y cómo se disparan las alertas'}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nombre *"
            placeholder="Ej: Stock crítico iPhone 15"
            value={formData.name}
            onChange={e => handleChange('name', e.target.value)}
            required
          />
          <Select
            value={formData.condition}
            onValueChange={v => handleChange('condition', v as AlertCondition)}
          >
            <SelectTrigger><SelectValue placeholder="Seleccionar condición" /></SelectTrigger>
            <SelectContent>
              {ALERT_CONDITIONS.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Textarea
          label="Descripción"
          placeholder="Descripción opcional de la regla"
          value={formData.description}
          onChange={e => handleChange('description', e.target.value)}
          rows={2}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Umbral *</Label>
            <Input
              type="number"
              step="any"
              min="0"
              value={formData.threshold}
              onChange={e => handleChange('threshold', e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Unidad</Label>
            <Input value={thresholdUnit} readOnly className="bg-surface-50" />
          </div>
          <div>
            <Label>Cooldown (min)</Label>
            <Input
              type="number"
              min="1"
              value={formData.cooldownMinutes}
              onChange={e => handleChange('cooldownMinutes', e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label>Severidad *</Label>
          <div className="flex gap-3">
            {ALERT_SEVERITIES.map(s => (
              <label
                key={s.value}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all ${
                  formData.severity === s.value
                    ? `border-${s.value === 'CRITICAL' ? 'danger' : s.value === 'WARNING' ? 'warning' : 'primary'}-500 bg-${s.value === 'CRITICAL' ? 'danger' : s.value === 'WARNING' ? 'warning' : 'primary'}-50 text-white`
                    : 'border-surface-200 hover:border-surface-300'
                }`}
              >
                <input
                  type="radio"
                  name="severity"
                  value={s.value}
                  checked={formData.severity === s.value}
                  onChange={() => handleChange('severity', s.value as AlertSeverity)}
                  className="sr-only"
                />
                <span className="font-medium capitalize">{s.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label>Canales de notificación</Label>
          <div className="flex flex-wrap gap-3 mt-2">
            {ALERT_CHANNELS.map(channel => (
              <label
                key={channel.value}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                  formData.channels.includes(channel.value)
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-surface-200 hover:border-surface-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={formData.channels.includes(channel.value)}
                  onChange={() => handleChannelToggle(channel.value)}
                  className="h-4 w-4 text-primary-600 rounded border-surface-300 focus:ring-primary-500"
                />
                <span className="flex items-center gap-1.5">
                  <span className="text-lg">{channel.icon}</span>
                  <span className="text-sm font-medium">{channel.label}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 border-t border-surface-200 pt-4">
          <Input
            label="Producto (UUID opcional)"
            placeholder="Filtrar por variante específica"
            value={formData.variantId}
            onChange={e => handleChange('variantId', e.target.value)}
          />
          <Input
            label="Ubicación (UUID opcional)"
            placeholder="Filtrar por ubicación específica"
            value={formData.locationId}
            onChange={e => handleChange('locationId', e.target.value)}
          />
          <Input
            label="Zona (UUID opcional)"
            placeholder="Filtrar por zona del mapa"
            value={formData.zoneId}
            onChange={e => handleChange('zoneId', e.target.value)}
          />
        </div>

        {editingRule && (
          <Label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={e => handleChange('isActive', e.target.checked)}
              className="h-4 w-4 text-primary-600 rounded border-surface-300 focus:ring-primary-500"
            />
            <span className="text-sm">Regla activa</span>
          </Label>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-surface-200">
          <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
            {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : editingRule ? 'Actualizar' : 'Crear Regla'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}