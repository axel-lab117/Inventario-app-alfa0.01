'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, Plus, Download, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardBody, Input, Button, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Dropdown, Modal } from '@repo/ui/components';
import { useToast } from '@repo/ui/components';

const mockProducts = [
  { id: '1', sku: 'SKU-001', name: 'iPhone 15 Pro 128GB', brand: 'Apple', category: 'Smartphones', stock: 45, price: 1299999, status: 'LISTED', condition: 'NEW' },
  { id: '2', sku: 'SKU-002', name: 'Samsung Galaxy S24 256GB', brand: 'Samsung', category: 'Smartphones', stock: 32, price: 999999, status: 'LISTED', condition: 'NEW' },
  { id: '3', sku: 'SKU-003', name: 'MacBook Air M3 13"', brand: 'Apple', category: 'Laptops', stock: 12, price: 1599999, status: 'LISTED', condition: 'NEW' },
  { id: '4', sku: 'SKU-004', name: 'iPad Pro 11" M4', brand: 'Apple', category: 'Tablets', stock: 8, price: 899999, status: 'UNLISTED', condition: 'NEW' },
  { id: '5', sku: 'SKU-005', name: 'Sony WH-1000XM5', brand: 'Sony', category: 'Audio', stock: 0, price: 399999, status: 'LISTED', condition: 'NEW' },
  { id: '6', sku: 'SKU-006', name: 'iPhone 14 128GB (Open Box)', brand: 'Apple', category: 'Smartphones', stock: 3, price: 899999, status: 'LISTED', condition: 'OPEN_BOX_A' },
];

const statusBadges: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  LISTED: 'success',
  UNLISTED: 'warning',
  DRAFT: 'neutral',
  ARCHIVED: 'danger',
};

const conditionBadges: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  NEW: 'primary',
  OPEN_BOX_A: 'success',
  OPEN_BOX_B: 'warning',
  OPEN_BOX_C: 'danger',
  DAMAGED: 'danger',
  REFURBISHED: 'neutral',
};

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [conditionFilter, setConditionFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const { toast } = useToast();

  const filteredProducts = mockProducts.filter(p => {
    const matchesSearch = p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.brand.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesCondition = conditionFilter === 'all' || p.condition === conditionFilter;
    return matchesSearch && matchesStatus && matchesCondition;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900">Inventario</h1>
          <p className="mt-1 text-surface-500">Gestiona tus productos y variantes</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm"><RefreshCw className="h-4 w-4 mr-2" /> Actualizar</Button>
          <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" /> Exportar</Button>
          <Button onClick={() => setShowModal(true)}><Plus className="h-4 w-4 mr-2" /> Nuevo Producto</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
              <Input
                placeholder="Buscar por SKU, nombre, marca..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Dropdown
              trigger={<Button variant="outline"><Filter className="h-4 w-4 mr-2" /> Estado</Button>}
              items={[
                { label: 'Todos', value: 'all' },
                { label: 'Listados', value: 'LISTED' },
                { label: 'No Listados', value: 'UNLISTED' },
                { label: 'Borradores', value: 'DRAFT' },
                { label: 'Archivados', value: 'ARCHIVED' },
              ]}
              onSelect={setStatusFilter}
              selectedValue={statusFilter}
            />
            <Dropdown
              trigger={<Button variant="outline"><Filter className="h-4 w-4 mr-2" /> Condición</Button>}
              items={[
                { label: 'Todas', value: 'all' },
                { label: 'Nuevo', value: 'NEW' },
                { label: 'Open Box A', value: 'OPEN_BOX_A' },
                { label: 'Open Box B', value: 'OPEN_BOX_B' },
                { label: 'Open Box C', value: 'OPEN_BOX_C' },
                { label: 'Dañado', value: 'DAMAGED' },
                { label: 'Reacondicionado', value: 'REFURBISHED' },
              ]}
              onSelect={setConditionFilter}
              selectedValue={conditionFilter}
            />
          </div>
          <span className="text-sm text-surface-500">{filteredProducts.length} productos</span>
        </CardHeader>

        <CardBody className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead className="hidden md:table-cell">Categoría</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Condición</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map(product => (
                <TableRow key={product.id}>
                  <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.brand}</TableCell>
                  <TableCell className="hidden md:table-cell">{product.category}</TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {product.stock === 0 ? (
                      <span className="text-danger-600">{product.stock}</span>
                    ) : product.stock < 10 ? (
                      <span className="text-warning-600">{product.stock}</span>
                    ) : (
                      product.stock
                    )}
                  </TableCell>
                  <TableCell><Badge variant={statusBadges[product.status]}>{product.status}</Badge></TableCell>
                  <TableCell><Badge variant={conditionBadges[product.condition]}>{product.condition}</Badge></TableCell>
                  <TableCell className="text-right font-mono">$ {product.price.toLocaleString('es-AR')}</TableCell>
                  <TableCell>
                    <Dropdown
                      trigger={<Button variant="ghost" size="sm" className="h-8 w-8 p-0">⋮</Button>}
                      items={[
                        { label: 'Editar', value: `edit-${product.id}` },
                        { label: 'Ver movimientos', value: `movements-${product.id}` },
                        { label: 'Ajustar stock', value: `adjust-${product.id}` },
                        { label: 'Duplicar', value: `duplicate-${product.id}` },
                        { label: 'Archivar', value: `archive-${product.id}`, danger: true },
                      ]}
                      onSelect={value => toast({ title: `Acción: ${value}`, type: 'info' })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Nuevo Producto"
        description="Completa la información para crear un nuevo producto"
      >
        <form className="space-y-4">
          <Input label="SKU" placeholder="SKU-001" />
          <Input label="Nombre" placeholder="Nombre del producto" />
          <Input label="Marca" placeholder="Marca" />
          <Input label="Categoría" placeholder="Categoría" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Precio" type="number" placeholder="0" />
            <Input label="Stock inicial" type="number" placeholder="0" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={() => { toast({ title: 'Producto creado', type: 'success' }); setShowModal(false); }}>Crear</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}