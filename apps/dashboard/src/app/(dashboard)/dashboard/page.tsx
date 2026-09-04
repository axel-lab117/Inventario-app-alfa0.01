import Link from 'next/link';
import { Card, CardBody, CardHeader, Badge } from '@repo/ui/components';
import { Package, Truck, AlertTriangle, TrendingUp, Users, Settings } from 'lucide-react';

const stats = [
  { label: 'Productos Activos', value: '1,234', icon: Package, color: 'primary', href: '/dashboard/inventory' },
  { label: 'Órdenes Pendientes', value: '56', icon: Truck, color: 'warning', href: '/dashboard/orders' },
  { label: 'Stock Bajo', value: '12', icon: AlertTriangle, color: 'danger', href: '/dashboard/inventory?filter=low' },
  { label: 'Devoluciones', value: '8', icon: TrendingUp, color: 'success', href: '/dashboard/returns' },
];

const quickActions = [
  { label: 'Nuevo Producto', href: '/dashboard/inventory/new', icon: Package },
  { label: 'Crear Orden Manual', href: '/dashboard/orders/new', icon: Truck },
  { label: 'Ajuste de Inventario', href: '/dashboard/inventory/adjust', icon: AlertTriangle },
  { label: 'Configurar Marketplace', href: '/dashboard/marketplaces', icon: Settings },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-surface-900">Dashboard</h1>
          <p className="mt-1 text-surface-500">Resumen general de tu almacén</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Link key={i} href={stat.href} className="block">
            <Card className="hover:shadow-md transition-shadow">
              <CardBody className="flex items-center gap-4 p-5">
                <div className={`rounded-xl p-3 bg-{stat.color}-100`}>
                  <stat.icon className={`h-6 w-6 text-{stat.color}-600`} />
                </div>
                <div>
                  <p className="text-sm text-surface-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-surface-900">{stat.value}</p>
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Acciones Rápidas</h2>
          </CardHeader>
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-2">
              {quickActions.map((action, i) => (
                <Link key={i} href={action.href} className="flex items-center gap-3 rounded-lg border border-surface-200 p-4 hover:bg-surface-50 transition-colors">
                  <div className="rounded-lg bg-primary-100 p-2">
                    <action.icon className="h-5 w-5 text-primary-600" />
                  </div>
                  <span className="font-medium text-surface-900">{action.label}</span>
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Actividad Reciente</h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              {[
                { type: 'order', text: 'Orden #ML-12345 recibida', time: 'hace 5 min', status: 'pending' },
                { type: 'stock', text: 'Stock actualizado: SKU-ABC-001', time: 'hace 12 min', status: 'success' },
                { type: 'return', text: 'Devolución #RET-001 inspeccionada', time: 'hace 1 hora', status: 'warning' },
                { type: 'sync', text: 'Sincronización MercadoLibre completada', time: 'hace 2 horas', status: 'success' },
              ].map((activity, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`rounded-full p-2 bg-{activity.status === 'success' ? 'success' : activity.status === 'warning' ? 'warning' : activity.status === 'pending' ? 'primary' : 'danger'}-100`}>
                    {activity.type === 'order' && <Truck className={`h-4 w-4 text-{activity.status === 'success' ? 'success' : activity.status === 'warning' ? 'warning' : 'primary'}-600`} />}
                    {activity.type === 'stock' && <Package className={`h-4 w-4 text-{activity.status === 'success' ? 'success' : 'primary'}-600`} />}
                    {activity.type === 'return' && <AlertTriangle className={`h-4 w-4 text-warning-600`} />}
                    {activity.type === 'sync' && <TrendingUp className={`h-4 w-4 text-success-600`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-900 truncate">{activity.text}</p>
                    <p className="text-xs text-surface-500">{activity.time}</p>
                  </div>
                  <Badge variant={activity.status === 'success' ? 'success' : activity.status === 'warning' ? 'warning' : activity.status === 'pending' ? 'primary' : 'danger'}>
                    {activity.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}