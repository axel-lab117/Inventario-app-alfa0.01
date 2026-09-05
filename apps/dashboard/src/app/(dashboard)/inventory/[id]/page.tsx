'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft, Edit, Trash2, Plus, Download, RefreshCw,
  Package, Box, Truck, Clock, AlertTriangle, CheckCircle,
  XCircle, Info, Settings, MapPin, Layers, BarChart2,
  Search, Filter, Eye, EyeOff, FileText, History,
  RotateCcw, ExternalLink, Tag, Hash, Calendar
} from 'lucide-react';
import {
  Card, CardHeader, CardBody, Button, Badge, Input,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Tabs, TabsList, TabsTrigger, TabsContent, Dropdown, Modal,
  Tooltip, Skeleton, Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Label, Switch, Separator
} from '@repo/ui/components';
import { useToast } from '@repo/ui/components';
import {
  useProduct,
  useProductVariants,
  useProductStockLevels,
  useStockMovements,
  useBatchTrace,
  useAdjustStock,
  useTransferStock,
  useDeleteProduct,
  formatPrice,
  formatDays,
  formatDate,
  formatRelativeTime,
  type ProductWithStock,
  type ProductVariant,
  type StockLevel,
  type StockMovement,
  type BatchTraceItem,
} from '@/hooks/useInventory';

function ProductSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-1/3 bg-surface-200 animate-pulse rounded" />
      <div className="h-4 w-1/4 bg-surface-200 animate-pulse rounded" />
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => (
          <Card key={i}><CardBody className="h-24 bg-surface-200 animate-pulse rounded" /></Card>
        ))}
      </div>
      <Card><CardBody className="h-96 bg-surface-200 animate-pulse rounded" /></Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, trend, trendUp = true }: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  trendUp?: boolean;
}) {
  return (
    <Card>
      <CardBody className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-surface-500">{label}</p>
            <p className="text-2xl font-bold text-surface-900 mt-1">{value}</p>
            {trend && (
              <p className={`text-xs mt-1 ${trendUp ? 'text-success-600' : 'text-danger-600'}`}>
                {trendUp ? <CheckCircle className="h-3 w-3 inline mr-1" /> : <XCircle className="h-3 w-3 inline mr-1" />}
                {trend}
              </p>
            )}
          </div>
          <div className="p-3 bg-primary-100 rounded-lg">
            <Icon className="h-6 w-6 text-primary-600" />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function VariantBadge({ variant }: { variant: ProductVariant }) {
  const conditionColors: Record<string, string> = {
    NEW: 'primary', OPEN_BOX_A: 'success', OPEN_BOX_B: 'warning',
    OPEN_BOX_C: 'danger', DAMAGED: 'danger', REFURBISHED: 'neutral',
  };
  const statusColors: Record<string, string> = {
    LISTED: 'success', UNLISTED: 'warning', DRAFT: 'neutral', ARCHIVED: 'danger',
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge variant={conditionColors[variant.condition] as any}>{variant.condition}</Badge>
      <Badge variant={statusColors[variant.listingStatus] as any}>{variant.listingStatus}</Badge>
      {variant.barcode && <Badge variant="neutral" className="font-mono text-xs">{variant.barcode}</Badge>}
    </div>
  );
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'specs' | 'variants' | 'stock' | 'movements' | 'batches'>('specs');
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<StockLevel | null>(null);
  const [adjustType, setAdjustType] = useState<'ADJUSTMENT' | 'RECEIPT' | 'REMOVE' | 'DAMAGE'>('ADJUSTMENT');

  const { data: product, isLoading, isError, error, refetch } = useProduct(productId);
  const { data: variants = [] } = useProductVariants(productId);
  const { data: stockLevels = [] } = useProductStockLevels(productId);
  const { data: movementsData, isLoading: movementsLoading } = useStockMovements({ variantId: productId, limit: 100 });
  const { data: batches = [], isLoading: batchesLoading } = useBatchTrace(productId ? variants[0]?.id || '' : '');

  const deleteMutation = useDeleteProduct();
  const adjustMutation = useAdjustStock();
  const transferMutation = useTransferStock();

  const movements = movementsData?.data || [];

  if (isLoading) return <ProductSkeleton />;
  if (isError || !product) {
    return (
      <Card className="max-w-2xl mx-auto mt-8">
        <CardBody className="p-8 text-center">
          <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-danger-500" />
          <h2 className="text-xl font-semibold text-surface-900">Producto no encontrado</h2>
          <p className="text-surface-500 mt-2">{error instanceof Error ? error.message : 'Error cargando producto'}</p>
          <Button className="mt-4" onClick={() => router.back()}><ChevronLeft className="h-4 w-4 mr-2" /> Volver</Button>
        </CardBody>
      </Card>
    );
  }

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteMutation.mutateAsync(product.id);
      toast({ title: 'Producto archivado', type: 'success' });
      router.push('/dashboard/inventory');
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error', type: 'error' });
    }
  };

  const handleAdjustSubmit = async (formData: FormData) => {
    if (!selectedVariant || !selectedLocation) return;
    try {
      await adjustMutation.mutateAsync({
        variantId: selectedVariant.id,
        locationId: selectedLocation.locationId,
        quantity: parseInt(formData.get('quantity') as string),
        type: adjustType,
        reason: formData.get('reason') as string || undefined,
        referenceId: formData.get('referenceId') as string || undefined,
      });
      toast({ title: 'Stock ajustado', type: 'success' });
      setShowAdjustModal(false);
      refetch();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error', type: 'error' });
    }
  };

  const handleTransferSubmit = async (formData: FormData) => {
    if (!selectedVariant) return;
    try {
      await transferMutation.mutateAsync({
        variantId: selectedVariant.id,
        fromLocationId: selectedLocation?.locationId || '',
        toLocationId: formData.get('toLocationId') as string,
        quantity: parseInt(formData.get('quantity') as string),
        reason: formData.get('reason') as string || undefined,
      });
      toast({ title: 'Stock transferido', type: 'success' });
      setShowTransferModal(false);
      refetch();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error', type: 'error' });
    }
  };

  const openAdjustModal = (variant: ProductVariant, location: StockLevel, type: typeof adjustType = 'ADJUSTMENT') => {
    setSelectedVariant(variant);
    setSelectedLocation(location);
    setAdjustType(type);
    setShowAdjustModal(true);
  };

  const openTransferModal = (variant: ProductVariant, location: StockLevel) => {
    setSelectedVariant(variant);
    setSelectedLocation(location);
    setShowTransferModal(true);
  };

  const totalStock = product.totalStock || 0;
  const totalReserved = product.totalReserved || 0;
  const totalAvailable = product.totalAvailable || 0;
  const daysInStock = product.daysInStock;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Volver
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-surface-900">{product.name}</h1>
            <p className="text-surface-500">{product.sku} • {product.brand || 'Sin marca'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={deleteMutation.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${deleteMutation.isPending ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
          <Dropdown
            trigger={<Button variant="outline" size="sm"><Settings className="h-4 w-4 mr-2" /> Acciones</Button>}
            items={[
              { label: 'Editar producto', value: 'edit' },
              { label: 'Duplicar', value: 'duplicate' },
              { label: 'Ajuste masivo', value: 'bulk-adjust' },
              { label: 'Exportar movimientos', value: 'export-movements' },
              { label: 'Archivar', value: 'archive', danger: true },
            ]}
            onSelect={v => {
              if (v === 'archive') handleDelete();
              else toast({ title: `Próximamente: ${v}`, type: 'info' });
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Stock Total" value={totalStock} icon={Package} />
        <StatCard label="Disponible" value={totalAvailable} icon={CheckCircle} trendUp={totalAvailable > 0} />
        <StatCard label="Reservado" value={totalReserved} icon={Clock} trendUp={false} />
        <StatCard label="Días en Stock" value={daysInStock !== null ? formatDays(daysInStock) : '—'} icon={Calendar} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="specs"><FileText className="h-4 w-4 mr-2" /> Especificaciones</TabsTrigger>
          <TabsTrigger value="variants"><Box className="h-4 w-4 mr-2" /> Variantes / Lotes</TabsTrigger>
          <TabsTrigger value="stock"><MapPin className="h-4 w-4 mr-2" /> Stock por Ubicación</TabsTrigger>
          <TabsTrigger value="movements"><History className="h-4 w-4 mr-2" /> Historial Movimientos</TabsTrigger>
          <TabsTrigger value="batches"><Tag className="h-4 w-4 mr-2" /> Trazabilidad Lotes</TabsTrigger>
        </TabsList>

        <TabsContent value="specs">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><h3 className="font-semibold text-surface-900">Información General</h3></CardHeader>
              <CardBody className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label>SKU</Label><p className="font-mono text-lg">{product.sku}</p></div>
                  <div><Label>GTIN / Código de barras</Label><p>{product.gtin || product.barcode || '—'}</p></div>
                  <div><Label>Nombre</Label><p>{product.name}</p></div>
                  <div><Label>Marca</Label><p>{product.brand || '—'}</p></div>
                  <div><Label>Modelo</Label><p>{product.model || '—'}</p></div>
                  <div><Label>Categoría</Label><p>{product.categoryId || '—'}</p></div>
                  <div className="sm:col-span-2"><Label>Descripción</Label><p className="whitespace-pre-wrap">{product.description || 'Sin descripción'}</p></div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader><h3 className="font-semibold text-surface-900">Precios y Costos</h3></CardHeader>
              <CardBody className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label>Precio Base</Label><p className="font-mono text-xl font-semibold">{formatPrice(product.basePrice)}</p></div>
                  <div><Label>Costo</Label><p className="font-mono text-xl">{formatPrice(product.costPrice)}</p></div>
                  {product.variants.length > 0 && (
                    <>
                      <div><Label>Precio Mín. Variante</Label>
                        <p className="font-mono text-xl">
                          {formatPrice(Math.min(...product.variants.filter(v => v.priceOverride).map(v => v.priceOverride!)))}
                        </p>
                      </div>
                      <div><Label>Precio Máx. Variante</Label>
                        <p className="font-mono text-xl">
                          {formatPrice(Math.max(...product.variants.filter(v => v.priceOverride).map(v => v.priceOverride!)))}
                        </p>
                      </div>
                    </>
                  )}
                  <div><Label>Margen Estimado</Label>
                    <p className="font-mono text-xl font-semibold text-success-600">
                      {product.basePrice > 0 ? `${(((product.basePrice - product.costPrice) / product.basePrice) * 100).toFixed(1)}%` : '—'}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader><h3 className="font-semibold text-surface-900">Atributos Físicos</h3></CardHeader>
              <CardBody className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label>Peso (g)</Label><p>{product.weightGrams?.toLocaleString() || '—'}</p></div>
                  <div><Label>Dimensiones (LxAxA cm)</Label>
                    <p>{product.dimensions ? `${(product.dimensions as any).length || '?'} x ${(product.dimensions as any).width || '?'} x ${(product.dimensions as any).height || '?'}` : '—'}</p>
                  </div>
                  <div className="sm:col-span-2"><Label>Imágenes</Label>
                    <div className="flex gap-2 flex-wrap">
                      {product.images?.slice(0, 6).map((img, i) => (
                        <img key={i} src={img} alt={`${product.name} ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border border-surface-200" />
                      ))}
                      {!product.images?.length && <span className="text-surface-400 text-sm">Sin imágenes</span>}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader><h3 className="font-semibold text-surface-900">Atributos Extra (JSON)</h3></CardHeader>
              <CardBody>
                <pre className="bg-surface-100 p-4 rounded text-sm overflow-x-auto max-h-64">
                  {JSON.stringify(product.attributes, null, 2) || '{}'}
                </pre>
              </CardBody>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="variants">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-surface-900">{variants.length} Variantes</h3>
            <Button variant="outline" size="sm" disabled><Plus className="h-4 w-4 mr-2" /> Nueva Variante</Button>
          </div>
          <Card>
            <CardBody className="p-0">
              {variants.length === 0 ? (
                <div className="p-12 text-center">
                  <Box className="h-16 w-16 mx-auto mb-4 text-surface-300" />
                  <p className="text-surface-500">No hay variantes creadas</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU Variante</TableHead>
                      <TableHead>Código de Barras</TableHead>
                      <TableHead>Condición</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Stock Total</TableHead>
                      <TableHead>Disponible</TableHead>
                      <TableHead className="w-32">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variants.map(variant => {
                      const vStock = stockLevels.filter(sl => sl.variantId === variant.id);
                      const total = vStock.reduce((sum, sl) => sum + sl.quantity, 0);
                      const available = vStock.reduce((sum, sl) => sum + sl.availableQuantity, 0);
                      const reserved = vStock.reduce((sum, sl) => sum + sl.reservedQuantity, 0);
                      return (
                        <TableRow key={variant.id}>
                          <TableCell className="font-mono text-sm">{variant.sku}</TableCell>
                          <TableCell className="font-mono text-sm">{variant.barcode || '—'}</TableCell>
                          <TableCell><Badge variant={({ NEW: 'primary', OPEN_BOX_A: 'success', OPEN_BOX_B: 'warning', OPEN_BOX_C: 'danger', DAMAGED: 'danger', REFURBISHED: 'neutral' } as any)[variant.condition]}>{variant.condition}</Badge></TableCell>
                          <TableCell><Badge variant={({ LISTED: 'success', UNLISTED: 'warning', DRAFT: 'neutral', ARCHIVED: 'danger' } as any)[variant.listingStatus]}>{variant.listingStatus}</Badge></TableCell>
                          <TableCell className="font-mono">{variant.priceOverride ? formatPrice(variant.priceOverride) : formatPrice(product.basePrice)}</TableCell>
                          <TableCell className="font-mono font-medium">{total}</TableCell>
                          <TableCell className="font-mono">{available}</TableCell>
                          <TableCell>
                            <Dropdown
                              trigger={<Button variant="ghost" size="sm" className="h-8 w-8 p-0">⋮</Button>}
                              items={[
                                { label: 'Ver stock detallado', value: `stock-${variant.id}` },
                                { label: 'Ajustar stock', value: `adjust-${variant.id}` },
                                { label: 'Transferir', value: `transfer-${variant.id}` },
                                { label: 'Ver movimientos', value: `movements-${variant.id}` },
                                { label: 'Trazabilidad lotes', value: `batches-${variant.id}` },
                              ]}
                              onSelect={value => {
                                const [action, id] = value.split('-');
                                const variant = variants.find(v => v.id === id);
                                if (!variant) return;
                                const location = stockLevels.find(sl => sl.variantId === id);
                                if (action === 'adjust' && location) openAdjustModal(variant, location);
                                else if (action === 'transfer' && location) openTransferModal(variant, location);
                                else if (action === 'stock') setActiveTab('stock');
                                else if (action === 'movements') setActiveTab('movements');
                                else if (action === 'batches') setActiveTab('batches');
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardBody>
          </Card>
        </TabsContent>

        <TabsContent value="stock">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
              <h3 className="font-semibold text-surface-900">Stock por Ubicación ({stockLevels.length})</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" /> Exportar</Button>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {stockLevels.length === 0 ? (
                <div className="p-12 text-center">
                  <MapPin className="h-16 w-16 mx-auto mb-4 text-surface-300" />
                  <p className="text-surface-500">Sin stock registrado en ubicaciones</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ubicación</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Reservado</TableHead>
                      <TableHead className="text-right">Disponible</TableHead>
                      <TableHead>Últ. Conteo</TableHead>
                      <TableHead>Ocupación</TableHead>
                      <TableHead className="w-32">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockLevels.map(level => {
                      const occupancy = level.location?.capacity ? Math.round((level.quantity / (level.location.capacity || 1)) * 100) : 0;
                      const occColor = occupancy > 90 ? 'danger' : occupancy > 70 ? 'warning' : 'success';
                      return (
                        <TableRow key={level.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{level.location?.code || level.locationId}</p>
                              <p className="text-sm text-surface-500">{level.location?.name || ''}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="neutral" className="text-xs">{level.location?.type || '—'}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">{level.quantity}</TableCell>
                          <TableCell className="text-right font-mono text-warning-600">{level.reservedQuantity}</TableCell>
                          <TableCell className="text-right font-mono text-success-600">{level.availableQuantity}</TableCell>
                          <TableCell>{level.lastCountedAt ? formatRelativeTime(level.lastCountedAt) : 'Nunca'}</TableCell>
                          <TableCell>
                            {level.location?.capacity && (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-surface-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-primary-500 transition-all" style={{ width: `${Math.min(occupancy, 100)}%` }} />
                                </div>
                                <Badge variant={occColor as any} className="text-xs">{occupancy}%</Badge>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Dropdown
                              trigger={<Button variant="ghost" size="sm" className="h-8 w-8 p-0">⋮</Button>}
                              items={[
                                { label: 'Ajustar stock', value: `adjust-${level.id}` },
                                { label: 'Transferir', value: `transfer-${level.id}` },
                                { label: 'Conteo cíclico', value: `count-${level.id}` },
                                { label: 'Ver movimientos', value: `movements-${level.id}` },
                              ]}
                              onSelect={value => {
                                const [action, id] = value.split('-');
                                const level = stockLevels.find(sl => sl.id === id);
                                const variant = variants.find(v => v.id === level?.variantId);
                                if (!variant || !level) return;
                                if (action === 'adjust') openAdjustModal(variant, level);
                                else if (action === 'transfer') openTransferModal(variant, level);
                                else if (action === 'count') openAdjustModal(variant, level, 'CYCLE_COUNT');
                                else setActiveTab('movements');
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardBody>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
              <h3 className="font-semibold text-surface-900">Historial de Movimientos ({movements.length})</h3>
              <div className="flex gap-2">
                <Select placeholder="Filtrar por tipo" value="all" onValueChange={v => {}}>
                  <SelectTrigger><SelectValue placeholder="Todos los tipos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="RECEIPT">Recepción</SelectItem>
                    <SelectItem value="REMOVE">Remoción</SelectItem>
                    <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                    <SelectItem value="TRANSFER_IN">Transferencia In</SelectItem>
                    <SelectItem value="TRANSFER_OUT">Transferencia Out</SelectItem>
                    <SelectItem value="DAMAGE">Daño</SelectItem>
                    <SelectItem value="CYCLE_COUNT">Conteo Cíclico</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" /> Exportar</Button>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {movementsLoading ? (
                <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-3 border-primary-500 border-t-transparent mx-auto" /></div>
              ) : movements.length === 0 ? (
                <div className="p-12 text-center">
                  <History className="h-16 w-16 mx-auto mb-4 text-surface-300" />
                  <p className="text-surface-500">Sin movimientos registrados</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Variante</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Empleado</TableHead>
                      <TableHead>Razón</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map(mov => (
                      <TableRow key={mov.id}>
                        <TableCell className="font-mono text-sm">{formatDate(mov.createdAt)}</TableCell>
                        <TableCell>
                          <Badge variant={({
                            RECEIPT: 'success', REMOVE: 'danger', RETURN: 'primary',
                            ADJUSTMENT: 'warning', TRANSFER_IN: 'info', TRANSFER_OUT: 'info',
                            DAMAGE: 'danger', CYCLE_COUNT: 'neutral',
                          } as any)[mov.type]}>{mov.type}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{mov.variant?.sku || mov.variantId.slice(0, 8)}</TableCell>
                        <TableCell>{mov.location?.code || mov.locationId.slice(0, 8)}</TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {mov.quantity > 0 ? '+' : ''}{mov.quantity}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-surface-500">
                          {mov.referenceId ? `${mov.referenceType}: ${mov.referenceId.slice(0, 12)}` : '—'}
                        </TableCell>
                        <TableCell>{mov.employee?.name || 'Sistema'}</TableCell>
                        <TableCell className="max-w-xs truncate">{mov.reason || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardBody>
          </Card>
        </TabsContent>

        <TabsContent value="batches">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
              <h3 className="font-semibold text-surface-900">Trazabilidad por Lote ({batches.length})</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" /> Exportar</Button>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {batchesLoading ? (
                <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-3 border-primary-500 border-t-transparent mx-auto" /></div>
              ) : batches.length === 0 ? (
                <div className="p-12 text-center">
                  <Tag className="h-16 w-16 mx-auto mb-4 text-surface-300" />
                  <p className="text-surface-500">Sin trazabilidad de lotes disponible</p>
                  <p className="text-sm text-surface-400 mt-1">Los lotes se generan automáticamente en recepciones</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lote (Ref ID)</TableHead>
                      <TableHead>Tipo Movimiento</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Empleado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map(batch => (
                      <TableRow key={batch.id}>
                        <TableCell className="font-mono text-sm font-medium">{batch.referenceId.slice(0, 20)}</TableCell>
                        <TableCell>
                          <Badge variant={({
                            RECEIPT: 'success', REMOVE: 'danger', RETURN: 'primary',
                            ADJUSTMENT: 'warning', TRANSFER_IN: 'info', TRANSFER_OUT: 'info',
                          } as any)[batch.type]}>{batch.type}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-right">
                          {batch.quantity > 0 ? '+' : ''}{batch.quantity}
                        </TableCell>
                        <TableCell>{batch.locationCode} - {batch.locationName}</TableCell>
                        <TableCell className="font-mono text-sm">{formatDate(batch.createdAt)}</TableCell>
                        <TableCell>{batch.employeeName || 'Sistema'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardBody>
          </Card>
        </TabsContent>
      </Tabs>

      <AdjustModal
        isOpen={showAdjustModal}
        onClose={() => { setShowAdjustModal(false); setSelectedVariant(null); setSelectedLocation(null); }}
        variant={selectedVariant}
        location={selectedLocation}
        adjustType={adjustType}
        setAdjustType={setAdjustType}
        onSubmit={handleAdjustSubmit}
        isPending={adjustMutation.isPending}
      />

      <TransferModal
        isOpen={showTransferModal}
        onClose={() => { setShowTransferModal(false); setSelectedVariant(null); setSelectedLocation(null); }}
        variant={selectedVariant}
        fromLocation={selectedLocation}
        onSubmit={handleTransferSubmit}
        isPending={transferMutation.isPending}
      />
    </div>
  );
}

function AdjustModal({
  isOpen, onClose, variant, location, adjustType, setAdjustType, onSubmit, isPending
}: {
  isOpen: boolean; onClose: () => void;
  variant: ProductVariant | null; location: StockLevel | null;
  adjustType: 'ADJUSTMENT' | 'RECEIPT' | 'REMOVE' | 'DAMAGE';
  setAdjustType: (t: typeof adjustType) => void;
  onSubmit: (fd: FormData) => void; isPending: boolean;
}) {
  if (!variant || !location) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Ajuste: ${adjustType}`} description={`${variant.sku} en ${location.location?.code || location.locationId}`} size="md">
      <form onSubmit={e => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }} className="space-y-4">
        <input type="hidden" name="adjustType" value={adjustType} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Ubicación</Label><Input value={`${location.location?.code} - ${location.location?.name}`} readOnly /></div>
          <div><Label>Stock Actual</Label><Input value={String(location.quantity)} readOnly className="bg-surface-50" /></div>
          <div><Label>Disponible</Label><Input value={String(location.availableQuantity)} readOnly className="bg-surface-50" /></div>
        </div>
        <Separator />
        <div className="grid gap-4 sm:grid-cols-3">
          {(['ADJUSTMENT', 'RECEIPT', 'REMOVE', 'DAMAGE'] as const).map(type => (
            <label key={type} className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all ${
              adjustType === type ? 'border-primary-500 bg-primary-50' : 'border-surface-200 hover:border-surface-300'
            }`}>
              <input type="radio" name="adjustType" value={type} checked={adjustType === type} onChange={() => setAdjustType(type)} className="sr-only" />
              <span className="font-medium capitalize">{type.toLowerCase()}</span>
            </label>
          ))}
        </div>
        <Input label="Cantidad *" type="number" name="quantity" placeholder="Ej: 10 (positivo para entrada, negativo para salida)" required />
        <Input label="Referencia (opcional)" name="referenceId" placeholder="OC-1234, RM-5678, etc." />
        <Input label="Razón (opcional)" name="reason" placeholder="Motivo del ajuste" />
        <div className="flex justify-end gap-3 pt-4 border-t border-surface-200">
          <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={isPending}>{isPending ? 'Procesando...' : 'Aplicar Ajuste'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function TransferModal({
  isOpen, onClose, variant, fromLocation, onSubmit, isPending
}: {
  isOpen: boolean; onClose: () => void;
  variant: ProductVariant | null; fromLocation: StockLevel | null;
  onSubmit: (fd: FormData) => void; isPending: boolean;
}) {
  if (!variant || !fromLocation) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Transferir Stock" description={`${variant.sku} desde ${fromLocation.location?.code || fromLocation.locationId}`} size="md">
      <form onSubmit={e => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }} className="space-y-4">
        <input type="hidden" name="fromLocationId" value={fromLocation.locationId} />
        <Input label="Ubicación Destino (UUID) *" name="toLocationId" placeholder="UUID de ubicación destino" required />
        <Input label="Cantidad a Transferir *" type="number" min="1" max={fromLocation.availableQuantity} name="quantity" placeholder={String(fromLocation.availableQuantity)} required />
        <Input label="Razón (opcional)" name="reason" placeholder="Motivo de la transferencia" />
        <div className="flex justify-end gap-3 pt-4 border-t border-surface-200">
          <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={isPending}>{isPending ? 'Transfiriendo...' : 'Transferir'}</Button>
        </div>
      </form>
    </Modal>
  );
}