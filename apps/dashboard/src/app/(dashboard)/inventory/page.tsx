'use client';

import { useState, useCallback } from 'react';
import { Search, Filter, Plus, Download, RefreshCw, ChevronRight, AlertTriangle, Package, Clock } from 'lucide-react';
import { Card, CardHeader, CardBody, Input, Button, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Dropdown, Modal, Tabs, TabsList, TabsTrigger, TabsContent, Skeleton } from '@repo/ui/components';
import { useToast } from '@repo/ui/components';
import { useProducts, useCreateProduct, useDeleteProduct, type ProductWithStock, type InventoryFilters } from '@/hooks/useInventory';
import { ProductConditionEnum, ListingStatusEnum } from '@repo/shared-types/inventory';

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

const STATUS_OPTIONS = [
  { label: 'Todos', value: 'all' },
  { label: 'Listados', value: 'LISTED' },
  { label: 'No Listados', value: 'UNLISTED' },
  { label: 'Borradores', value: 'DRAFT' },
  { label: 'Archivados', value: 'ARCHIVED' },
] as const;

const CONDITION_OPTIONS = [
  { label: 'Todas', value: 'all' },
  { label: 'Nuevo', value: 'NEW' },
  { label: 'Open Box A', value: 'OPEN_BOX_A' },
  { label: 'Open Box B', value: 'OPEN_BOX_B' },
  { label: 'Open Box C', value: 'OPEN_BOX_C' },
  { label: 'Dañado', value: 'DAMAGED' },
  { label: 'Reacondicionado', value: 'REFURBISHED' },
] as const;

function ProductSkeleton() {
  return (
    <TableRow>
      <TableCell><Skeleton className="w-20 h-4" /></TableCell>
      <TableCell><Skeleton className="w-40 h-4" /></TableCell>
      <TableCell><Skeleton className="w-24 h-4" /></TableCell>
      <TableCell className="hidden md:table-cell"><Skeleton className="w-28 h-4" /></TableCell>
      <TableCell className="text-right"><Skeleton className="w-16 h-4" /></TableCell>
      <TableCell><Skeleton className="w-24 h-6" /></TableCell>
      <TableCell><Skeleton className="w-24 h-6" /></TableCell>
      <TableCell className="text-right"><Skeleton className="w-24 h-4" /></TableCell>
      <TableCell><Skeleton className="w-8 h-8" /></TableCell>
    </TableRow>
  );
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(price);
}

function formatDays(days: number | null): string {
  if (days === null || days === undefined) return '—';
  if (days < 1) return 'Hoy';
  if (days === 1) return '1 día';
  if (days < 30) return `${days} días`;
  if (days < 365) return `${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? 'es' : ''}`;
  return `${Math.floor(days / 365)} año${Math.floor(days / 365) > 1 ? 's' : ''}`;
}

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [conditionFilter, setConditionFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<InventoryFilters['sortBy']>('createdAt');
  const [sortOrder, setSortOrder] = useState<InventoryFilters['sortOrder']>('desc');
  const { toast } = useToast();
  const createProductMutation = useCreateProduct();
  const deleteProductMutation = useDeleteProduct();

  const filters: InventoryFilters = {
    search: search || undefined,
    status: statusFilter !== 'all' ? [statusFilter as any] : undefined,
    condition: conditionFilter !== 'all' ? [conditionFilter as any] : undefined,
    page,
    limit: 20,
    sortBy,
    sortOrder,
  };

  const { data, isLoading, isError, error, refetch } = useProducts(filters);

  const handleSort = useCallback((field: InventoryFilters['sortBy']) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  }, [sortBy]);

  const handleCreateProduct = async (formData: FormData) => {
    try {
      await createProductMutation.mutateAsync({
        sku: formData.get('sku') as string,
        name: formData.get('name') as string,
        brand: formData.get('brand') as string,
        categoryId: formData.get('categoryId') as string || undefined,
        basePrice: parseFloat(formData.get('basePrice') as string) || 0,
        costPrice: parseFloat(formData.get('costPrice') as string) || 0,
        description: formData.get('description') as string || undefined,
      });
      toast({ title: 'Producto creado', type: 'success' });
      setShowModal(false);
    } catch (err) {
      toast({ title: 'Error al crear producto', description: err instanceof Error ? err.message : 'Error desconocido', type: 'error' });
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('¿Estás seguro de que querés archivar este producto?')) return;
    try {
      await deleteProductMutation.mutateAsync(id);
      toast({ title: 'Producto archivado', type: 'success' });
    } catch (err) {
      toast({ title: 'Error al archivar', description: err instanceof Error ? err.message : 'Error desconocido', type: 'error' });
    }
  };

  const products = data?.data || [];
  const total = data?.meta.total || 0;
  const totalPages = data?.meta.totalPages || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900">Inventario</h1>
          <p className="mt-1 text-surface-500">Gestiona tus productos, variantes y stock por ubicación</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
          <Button variant="outline" size="sm" disabled={isLoading}>
            <Download className="h-4 w-4 mr-2" /> Exportar
          </Button>
          <Button onClick={() => setShowModal(true)} disabled={createProductMutation.isPending}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo Producto
          </Button>
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
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-10"
              />
            </div>
            <Dropdown
              trigger={<Button variant="outline"><Filter className="h-4 w-4 mr-2" /> Estado</Button>}
              items={STATUS_OPTIONS}
              onSelect={v => { setStatusFilter(v); setPage(1); }}
              selectedValue={statusFilter}
            />
            <Dropdown
              trigger={<Button variant="outline"><Filter className="h-4 w-4 mr-2" /> Condición</Button>}
              items={CONDITION_OPTIONS}
              onSelect={v => { setConditionFilter(v); setPage(1); }}
              selectedValue={conditionFilter}
            />
          </div>
          <span className="text-sm text-surface-500">{total} productos ({products.length} en esta página)</span>
        </CardHeader>

        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" size="sm" className="p-0 h-auto" onClick={() => handleSort('sku')}>
                      SKU <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" className="p-0 h-auto" onClick={() => handleSort('name')}>
                      Producto <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" className="p-0 h-auto" onClick={() => handleSort('name')}>
                      Marca <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    <Button variant="ghost" size="sm" className="p-0 h-auto" onClick={() => handleSort('name')}>
                      Categoría <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" size="sm" className="p-0 h-auto" onClick={() => handleSort('stock')}>
                      Stock Total <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Condición</TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" size="sm" className="p-0 h-auto" onClick={() => handleSort('createdAt')}>
                      Precio Base <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">Días en Stock</TableHead>
                  <TableHead className="w-24">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <ProductSkeleton key={i} />)
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-surface-500">
                      No se encontraron productos
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map(product => (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                      <TableCell className="font-medium max-w-xs truncate" title={product.name}>{product.name}</TableCell>
                      <TableCell>{product.brand || '—'}</TableCell>
                      <TableCell className="hidden md:table-cell">{product.categoryId || '—'}</TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <span className={
                            product.totalStock === 0 ? 'text-danger-600' :
                            product.totalStock < 10 ? 'text-warning-600' :
                            'text-surface-900'
                          }>{product.totalStock}</span>
                          {product.totalReserved > 0 && (
                            <Badge variant="neutral" className="text-xs">Reservados: {product.totalReserved}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant={statusBadges[product.variants[0]?.listingStatus || 'UNLISTED']}>
                        {product.variants[0]?.listingStatus || 'UNLISTED'}
                      </Badge></TableCell>
                      <TableCell>
                        {product.variants.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {product.variants.map(v => (
                              <Badge key={v.id} variant={conditionBadges[v.condition]} className="text-xs">{v.condition}</Badge>
                            ))}
                          </div>
                        ) : (
                          <Badge variant="neutral">—</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatPrice(product.basePrice)}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {product.daysInStock !== null ? (
                          <>
                            <Clock className="h-3.5 w-3.5 inline-block mr-1 text-surface-400" />
                            {formatDays(product.daysInStock)}
                          </>
                        ) : (
                          <span className="text-surface-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Dropdown
                          trigger={<Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={deleteProductMutation.isPending}>⋮</Button>}
                          items={[
                            { label: 'Ver detalle', value: `view-${product.id}` },
                            { label: 'Ver movimientos', value: `movements-${product.id}` },
                            { label: 'Ajustar stock', value: `adjust-${product.id}` },
                            { label: 'Transferir', value: `transfer-${product.id}` },
                            { label: 'Duplicar', value: `duplicate-${product.id}` },
                            { label: 'Archivar', value: `archive-${product.id}`, danger: true },
                          ]}
                          onSelect={value => {
                            const [action, id] = value.split('-');
                            switch (action) {
                              case 'archive':
                                handleDeleteProduct(id);
                                break;
                              case 'adjust':
                                toast({ title: 'Ajustar stock', description: `Próximamente: modal para ${id}`, type: 'info' });
                                break;
                              case 'transfer':
                                toast({ title: 'Transferir stock', description: `Próximamente: modal para ${id}`, type: 'info' });
                                break;
                              default:
                                toast({ title: `Acción: ${action}`, description: `ID: ${id}`, type: 'info' });
                            }
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-surface-200">
              <span className="text-sm text-surface-500">Página {page} de {totalPages}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || isLoading}>Anterior</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || isLoading}>Siguiente</Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Nuevo Producto"
        description="Completa la información para crear un nuevo producto"
      >
        <form onSubmit={e => { e.preventDefault(); handleCreateProduct(new FormData(e.currentTarget)); }} className="space-y-4">
          <Input label="SKU *" placeholder="SKU-001" name="sku" required />
          <Input label="Nombre *" placeholder="Nombre del producto" name="name" required />
          <Input label="Marca" placeholder="Marca" name="brand" />
          <Input label="Categoría ID" placeholder="ID de categoría (opcional)" name="categoryId" />
          <Input label="Descripción" placeholder="Descripción" name="description" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Precio base *" type="number" step="0.01" min="0" placeholder="0" name="basePrice" required />
            <Input label="Costo *" type="number" step="0.01" min="0" placeholder="0" name="costPrice" required />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)} disabled={createProductMutation.isPending}>Cancelar</Button>
            <Button type="submit" disabled={createProductMutation.isPending}>
              {createProductMutation.isPending ? 'Creando...' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>

      {isError && (
        <div className="fixed bottom-4 right-4 z-50">
          <Card className="border-danger-500 bg-danger-50">
            <CardBody className="p-4">
              <div className="flex items-center gap-2 text-danger-700">
                <AlertTriangle className="h-5 w-5" />
                <span>Error cargando productos: {error instanceof Error ? error.message : 'Error desconocido'}</span>
                <Button variant="ghost" size="sm" onClick={() => refetch()}>Reintentar</Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}