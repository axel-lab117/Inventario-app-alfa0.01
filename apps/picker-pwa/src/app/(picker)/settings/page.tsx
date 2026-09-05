'use client';

import { useAuthStore } from '@/lib/auth-store';
import { User, RotateCcw, Settings, Shield, Bell, Smartphone, Wifi, Info } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, Input, Label, Switch } from '@repo/ui/components';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/picker/auth/login');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900">Configuración</h1>
        <p className="text-surface-500 mt-1">Preferencias de la aplicación</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
              <User className="h-8 w-8 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-surface-900">{user?.name}</h2>
              <p className="text-surface-500">{user?.email}</p>
              <p className="text-xs text-surface-400 capitalize">{user?.role} · {user?.tenantName}</p>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <Button variant="outline" onClick={handleLogout} className="w-full">
            <RotateCcw className="h-4 w-4 mr-2" /> Cerrar Sesión
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-surface-900 flex items-center gap-2">
            <Shield className="h-5 w-5" /> Seguridad
          </h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-surface-400" />
              <div>
                <p className="font-medium text-surface-900">Autenticación biométrica</p>
                <p className="text-sm text-surface-500">Usar FaceID / TouchID / Huella</p>
              </div>
            </div>
            <Switch checked={false} onCheckedChange={() => {}} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-surface-400" />
              <div>
                <p className="font-medium text-surface-900">Notificaciones push</p>
                <p className="text-sm text-surface-500">Recibir alertas en segundo plano</p>
              </div>
            </div>
            <Switch checked={true} onCheckedChange={() => {}} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-surface-900 flex items-center gap-2">
            <Smartphone className="h-5 w-5" /> App
          </h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wifi className="h-5 w-5 text-surface-400" />
              <div>
                <p className="font-medium text-surface-900">Sincronización automática</p>
                <p className="text-sm text-surface-500">Sincronizar al recuperar conexión</p>
              </div>
            </div>
            <Switch checked={true} onCheckedChange={() => {}} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-surface-400" />
              <div>
                <p className="font-medium text-surface-900">Modo debug</p>
                <p className="text-sm text-surface-500">Logs detallados para desarrollo</p>
              </div>
            </div>
            <Switch checked={false} onCheckedChange={() => {}} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-surface-900 flex items-center gap-2">
            <Info className="h-5 w-5" /> Información
          </h3>
        </CardHeader>
        <CardBody className="space-y-2 text-sm text-surface-600">
          <div className="flex justify-between"><span>Versión</span><span className="font-mono">1.0.0</span></div>
          <div className="flex justify-between"><span>Build</span><span className="font-mono">2024.01.15</span></div>
          <div className="flex justify-between"><span>Entorno</span><span className="font-mono">development</span></div>
        </CardBody>
      </Card>
    </div>
  );
}