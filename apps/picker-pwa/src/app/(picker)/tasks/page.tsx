'use client';

import { Package, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardBody, Badge, Button } from '@repo/ui/components';
import Link from 'next/link';

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900">Mis Tareas</h1>
        <p className="text-surface-500 mt-1">Tareas de picking asignadas</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-surface-900">Próximamente</h2>
        </CardHeader>
        <CardBody className="text-center py-12">
          <Package className="h-16 w-16 mx-auto mb-4 text-surface-300" />
          <h3 className="text-lg font-medium text-surface-700">Gestión de Tareas</h3>
          <p className="text-surface-500 mt-2">Aquí verás tus tareas de picking asignadas, con detalles de ubicación, cantidades y prioridad.</p>
          <div className="mt-6 space-y-3">
            <Link href="/picker/scan">
              <Button>Ir a Escanear</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}