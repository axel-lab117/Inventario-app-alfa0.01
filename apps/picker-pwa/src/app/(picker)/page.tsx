'use client';

import { useAuthStore } from '@/lib/auth-store';
import { Package, Box, Truck, RotateCcw, LayoutDashboard, History, Settings, User } from 'lucide-react';
import { Card, CardBody, Button } from '@repo/ui/components';
import Link from 'next/link';

const navItems = [
  { href: '/picker/scan', label: 'Escanear Cajas', description: 'Retirar cajas escaneando códigos', icon: Box, color: 'bg-primary-100 text-primary-600' },
  { href: '/picker/tasks', label: 'Mis Tareas', description: 'Ver tareas de picking asignadas', icon: Package, color: 'bg-success-100 text-success-600' },
  { href: '/picker/returns', label: 'Devoluciones', description: 'Gestionar devoluciones y RMA', icon: RotateCcw, color: 'bg-warning-100 text-warning-600' },
  { href: '/picker/history', label: 'Historial', description: 'Ver escaneos realizados', icon: History, color: 'bg-purple-100 text-purple-600' },
  { href: '/picker/settings', label: 'Configuración', description: 'Ajustes de la app', icon: Settings, color: 'bg-surface-100 text-surface-600' },
];

export default function PickerDashboard() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6 pb-24">
      <div className="px-4">
        <h1 className="text-3xl font-bold text-surface-900">WMS Picker</h1>
        <p className="text-surface-500 mt-1">Bienvenido, {user?.name || 'Usuario'}</p>
      </div>

      <div className="px-4 space-y-4">
        {navItems.map(item => (
          <Link key={item.href} href={item.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardBody className="p-5 flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${item.color}`}>
                  <item.icon className="h-7 w-7" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-surface-900">{item.label}</h3>
                  <p className="text-sm text-surface-500 mt-1">{item.description}</p>
                </div>
                <Box className="h-6 w-6 text-surface-400" />
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      <div className="px-4 pt-4 border-t border-surface-200">
        <p className="text-center text-xs text-surface-400">
          Versión 1.0.0 · Modo {'offline-first'}
        </p>
      </div>
    </div>
  );
}