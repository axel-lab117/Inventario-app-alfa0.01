'use client';

import { History, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardBody, Badge, Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@repo/ui/components';

const mockHistory = [
  { id: '1', code: 'BOX-SKU001-0042', status: 'synced', timestamp: Date.now() - 1000 * 60 * 5 },
  { id: '2', code: 'BOX-SKU002-0015', status: 'synced', timestamp: Date.now() - 1000 * 60 * 30 },
  { id: '3', code: 'BOX-SKU001-0043', status: 'pending', timestamp: Date.now() - 1000 * 60 * 60 },
  { id: '4', code: 'BOX-SKU003-0007', status: 'failed', timestamp: Date.now() - 1000 * 60 * 120, error: 'Stock insuficiente' },
];

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes}m`;
  if (hours < 24) return `Hace ${hours}h`;
  return `Hace ${days}d`;
}

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900">Historial de Escaneos</h1>
        <p className="text-surface-500 mt-1">Registro completo de escaneos realizados</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-surface-900">Escaneos Recientes</h2>
        </CardHeader>
        <CardBody className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="w-32">Detalles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockHistory.map((scan, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-sm">{scan.code}</TableCell>
                  <TableCell>
                    <Badge variant={
                      scan.status === 'synced' ? 'success' :
                      scan.status === 'pending' ? 'warning' : 'danger'
                    }>
                      {scan.status === 'synced' && <CheckCircle className="h-3 w-3 mr-1" />}
                      {scan.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                      {scan.status === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
                      {scan.status === 'synced' ? 'Sincronizado' : scan.status === 'pending' ? 'Pendiente' : 'Fallido'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatRelativeTime(scan.timestamp)}</TableCell>
                  <TableCell>
                    {scan.error && (
                      <Badge variant="danger" className="text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {scan.error}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}