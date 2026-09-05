'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { fabric } from 'fabric';
import {
  Plus, Edit, Trash2, Save, RotateCcw, Eye, EyeOff,
  Grid, Layers, Move, MousePointer, Square, Circle,
  Undo, Redo, Download, Upload, ZoomIn, ZoomOut,
  AlertTriangle, CheckCircle, XCircle, HelpCircle
} from 'lucide-react';
import {
  Card, CardHeader, CardBody, Button, Input, Badge,
  Dropdown, Modal, Tabs, TabsList, TabsTrigger, TabsContent,
  Tooltip
} from '@repo/ui/components';
import { useToast } from '@repo/ui/components';
import {
  useWarehouseMaps,
  useWarehouseMap,
  useCreateWarehouseMap,
  useUpdateWarehouseMap,
  useDeleteWarehouseMap,
  useZones,
  useCreateZone,
  useUpdateZone,
  useDeleteZone,
  useBinOccupancy,
} from '@/hooks/useWarehouse';
import type { WarehouseMap, Zone, BinOccupancy } from '@repo/shared-types/warehouse';

const DEFAULT_VIEWBOX = { x: 0, y: 0, width: 1200, height: 800 };
const GRID_SIZE = 50;

const ZONE_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
];

function generateId() {
  return crypto.randomUUID();
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function createGridPattern(canvas: fabric.Canvas, size: number, color: string) {
  const patternCanvas = document.createElement('canvas');
  patternCanvas.width = size;
  patternCanvas.height = size;
  const ctx = patternCanvas.getContext('2d')!;
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size, 0);
  ctx.moveTo(0, 0);
  ctx.lineTo(0, size);
  ctx.stroke();
  return new fabric.Pattern({
    source: patternCanvas,
    repeat: 'repeat',
  });
}

export default function WarehouseMapPage() {
  const { toast } = useToast();
  const [activeMapId, setActiveMapId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [selectedTool, setSelectedTool] = useState<'select' | 'rect' | 'polygon' | 'path'>('select');
  const [showGrid, setShowGrid] = useState(true);
  const [showOccupancy, setShowOccupancy] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [canvasScale, setCanvasScale] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const gridPatternRef = useRef<fabric.Pattern | null>(null);

  const { data: maps, isLoading: mapsLoading, refetch: refetchMaps } = useWarehouseMaps();
  const { data: map, isLoading: mapLoading, refetch: refetchMap } = useWarehouseMap(activeMapId || '');
  const { data: zones = [], refetch: refetchZones } = useZones(activeMapId || '');
  const { data: occupancy = [], refetch: refetchOccupancy } = useBinOccupancy(activeMapId || '');

  const createMapMutation = useCreateWarehouseMap();
  const updateMapMutation = useUpdateWarehouseMap();
  const deleteMapMutation = useDeleteWarehouseMap();
  const createZoneMutation = useCreateZone();
  const updateZoneMutation = useUpdateZone();
  const deleteZoneMutation = useDeleteZone();

  useEffect(() => {
    if (maps?.length && !activeMapId) {
      setActiveMapId(maps[0].id);
    }
  }, [maps, activeMapId]);

  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      selection: true,
      preserveObjectStacking: true,
      backgroundColor: '#f8fafc',
    });

    fabricRef.current = canvas;

    canvas.on('object:selected', (e) => {
      if (e.target && 'zoneId' in e.target) {
        const zone = zones.find(z => z.id === (e.target as any).zoneId);
        if (zone && editingZone?.id !== zone.id) {
          setEditingZone(zone);
        }
      }
    });

    canvas.on('selection:cleared', () => {
      setEditingZone(null);
    });

    canvas.on('object:modified', (e) => {
      if (e.target && 'zoneId' in e.target) {
        const zoneId = (e.target as any).zoneId;
        const path = (e.target as fabric.Path).toSVG();
        updateZoneMutation.mutate({
          zoneId,
          data: { path },
        });
      }
    });

    if (map) {
      loadMapToCanvas(map);
    }

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, []);

  const loadMapToCanvas = useCallback((warehouseMap: WarehouseMap) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.clear();

    if (warehouseMap.svgContent) {
      fabric.loadSVGFromString(warehouseMap.svgContent, (objects, options) => {
        const group = fabric.util.groupSVGElements(objects, options);
        canvas.add(group);
        canvas.renderAll();
      }, (item, object) => {
        if (object) {
          object.selectable = false;
          object.evented = false;
        }
      });
    }

    if (warehouseMap.viewBox) {
      canvas.setWidth(warehouseMap.viewBox.width);
      canvas.setHeight(warehouseMap.viewBox.height);
      canvas.setViewportTransform([
        warehouseMap.scale, 0, 0, warehouseMap.scale,
        -warehouseMap.viewBox.x * warehouseMap.scale,
        -warehouseMap.viewBox.y * warehouseMap.scale
      ]);
    }

    zones.forEach(zone => addZoneToCanvas(zone));
    canvas.renderAll();
  }, [zones]);

  const addZoneToCanvas = useCallback((zone: Zone) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    try {
      const path = new fabric.Path(zone.path, {
        fill: hexToRgba(zone.color, 0.3),
        stroke: zone.color,
        strokeWidth: 2,
        selectable: true,
        evented: true,
        hoverCursor: 'pointer',
      });
      (path as any).zoneId = zone.id;
      (path as any).zoneName = zone.name;
      canvas.add(path);
    } catch (e) {
      console.error('Error adding zone to canvas:', e);
    }
  }, []);

  const handleCreateMap = async (formData: FormData) => {
    try {
      await createMapMutation.mutateAsync({
        name: formData.get('name') as string,
        viewBox: DEFAULT_VIEWBOX,
        scale: 1,
        svgContent: '',
      });
      toast({ title: 'Mapa creado', type: 'success' });
      setShowCreateModal(false);
      refetchMaps();
    } catch (err) {
      toast({ title: 'Error creando mapa', description: err instanceof Error ? err.message : 'Error', type: 'error' });
    }
  };

  const handleSaveMap = async () => {
    if (!activeMapId || !fabricRef.current) return;

    const canvas = fabricRef.current;
    const svgContent = canvas.toSVG();
    const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
    const scale = vpt[0];
    const viewBox = {
      x: -vpt[4] / scale,
      y: -vpt[5] / scale,
      width: canvas.width || DEFAULT_VIEWBOX.width,
      height: canvas.height || DEFAULT_VIEWBOX.height,
    };

    try {
      await updateMapMutation.mutateAsync({
        id: activeMapId,
        data: { svgContent, viewBox, scale },
      });
      toast({ title: 'Mapa guardado', type: 'success' });
    } catch (err) {
      toast({ title: 'Error guardando', description: err instanceof Error ? err.message : 'Error', type: 'error' });
    }
  };

  const handleCreateZone = async (formData: FormData) => {
    if (!activeMapId) return;

    const points = JSON.parse(formData.get('points') as string);
    if (points.length < 3) {
      toast({ title: 'Mínimo 3 puntos', type: 'error' });
      return;
    }

    let pathData = `M ${points[0].x} ${points[0].y} `;
    for (let i = 1; i < points.length; i++) {
      pathData += `L ${points[i].x} ${points[i].y} `;
    }
    pathData += 'Z';

    try {
      await createZoneMutation.mutateAsync({
        mapId: activeMapId,
        data: {
          name: formData.get('name') as string,
          color: formData.get('color') as string,
          path: pathData,
          locations: [],
        },
      });
      toast({ title: 'Zona creada', type: 'success' });
      setShowZoneModal(false);
      refetchZones();
    } catch (err) {
      toast({ title: 'Error creando zona', description: err instanceof Error ? err.message : 'Error', type: 'error' });
    }
  };

  const handleUpdateZone = async (formData: FormData) => {
    if (!editingZone) return;

    try {
      await updateZoneMutation.mutateAsync({
        zoneId: editingZone.id,
        data: {
          name: formData.get('name') as string,
          color: formData.get('color') as string,
        },
      });
      toast({ title: 'Zona actualizada', type: 'success' });
      setEditingZone(null);
      refetchZones();
    } catch (err) {
      toast({ title: 'Error actualizando', description: err instanceof Error ? err.message : 'Error', type: 'error' });
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm('¿Eliminar esta zona?')) return;
    try {
      await deleteZoneMutation.mutateAsync(zoneId);
      toast({ title: 'Zona eliminada', type: 'success' });
      refetchZones();
    } catch (err) {
      toast({ title: 'Error eliminando', description: err instanceof Error ? err.message : 'Error', type: 'error' });
    }
  };

  const handleDeleteMap = async (mapId: string) => {
    if (!confirm('¿Eliminar este mapa y todas sus zonas?')) return;
    try {
      await deleteMapMutation.mutateAsync(mapId);
      toast({ title: 'Mapa eliminado', type: 'success' });
      if (activeMapId === mapId) setActiveMapId(null);
      refetchMaps();
    } catch (err) {
      toast({ title: 'Error eliminando', description: err instanceof Error ? err.message : 'Error', type: 'error' });
    }
  };

  const handleZoomIn = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const zoom = canvas.getZoom() * 1.2;
    canvas.zoomToPoint({ x: canvas.width! / 2, y: canvas.height! / 2 }, zoom);
    setCanvasScale(zoom);
  };

  const handleZoomOut = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const zoom = canvas.getZoom() / 1.2;
    canvas.zoomToPoint({ x: canvas.width! / 2, y: canvas.height! / 2 }, zoom);
    setCanvasScale(zoom);
  };

  const handleZoomReset = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    setCanvasScale(1);
  };

  const handleToggleGrid = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const newShowGrid = !showGrid;
    setShowGrid(newShowGrid);

    if (newShowGrid) {
      canvas.backgroundColor = gridPatternRef.current || createGridPattern(canvas, GRID_SIZE, '#e2e8f0');
    } else {
      canvas.backgroundColor = '#f8fafc';
    }
    canvas.renderAll();
  };

  const handleDownloadSVG = () => {
    if (!activeMapId || !fabricRef.current) return;
    const svg = fabricRef.current.toSVG();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `warehouse-map-${activeMapId}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const occupancyMap = new Map(occupancy.map(o => [o.locationId, o]));

  const getZoneOccupancy = (zone: Zone) => {
    let totalUsed = 0;
    let totalCapacity = 0;
    zone.locations.forEach(locId => {
      const occ = occupancyMap.get(locId);
      if (occ) {
        totalUsed += occ.usedCapacity;
        totalCapacity += occ.totalCapacity;
      }
    });
    return totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0;
  };

  if (mapsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900">Mapa de Depósito</h1>
          <p className="mt-1 text-surface-500">Editor visual de zonas, ubicaciones y rutas de picking</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleDownloadSVG} disabled={!activeMapId}>
            <Download className="h-4 w-4 mr-2" /> Exportar SVG
          </Button>
          <Button onClick={() => setShowCreateModal(true)} disabled={createMapMutation.isPending}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo Mapa
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-4 pb-4">
              <div className="flex items-center gap-4">
                <select
                  value={activeMapId || ''}
                  onChange={e => { setActiveMapId(e.target.value || null); setEditingZone(null); }}
                  className="input py-2 px-3 text-sm max-w-xs"
                  disabled={mapsLoading}
                >
                  <option value="">Seleccionar mapa...</option>
                  {maps?.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                {activeMapId && map && (
                  <>
                    <Badge variant="neutral">{map.zones.length} zonas</Badge>
                    <Badge variant={map.scale > 1 ? 'primary' : 'neutral'}>
                      Zoom: {Math.round(map.scale * 100)}%
                    </Badge>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Tooltip content="Cuadrícula">
                  <Button variant="outline" size="sm" onClick={handleToggleGrid}>
                    <Grid className={showGrid ? 'h-4 w-4' : 'h-4 w-4 opacity-50'} />
                  </Button>
                </Tooltip>
                <Tooltip content="Ocupación">
                  <Button variant="outline" size="sm" onClick={() => setShowOccupancy(!showOccupancy)}>
                    <Layers className={showOccupancy ? 'h-4 w-4' : 'h-4 w-4 opacity-50'} />
                  </Button>
                </Tooltip>
                <Tooltip content="Ajustar a cuadrícula">
                  <Button variant="outline" size="sm" onClick={() => setSnapToGrid(!snapToGrid)}>
                    <MousePointer className={snapToGrid ? 'h-4 w-4' : 'h-4 w-4 opacity-50'} />
                  </Button>
                </Tooltip>
                <div className="flex items-center gap-1 border-l border-surface-200 pl-2 ml-2">
                  <Button variant="ghost" size="sm" onClick={handleZoomOut} title="Alejar"><ZoomOut className="h-4 w-4" /></Button>
                  <span className="px-2 text-sm font-mono text-surface-600">{Math.round(canvasScale * 100)}%</span>
                  <Button variant="ghost" size="sm" onClick={handleZoomIn} title="Acercar"><ZoomIn className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={handleZoomReset} title="Restablecer"><RotateCcw className="h-4 w-4" /></Button>
                </div>
                <Button variant="primary" onClick={handleSaveMap} disabled={updateMapMutation.isPending || !activeMapId}>
                  <Save className="h-4 w-4 mr-2" /> Guardar Mapa
                </Button>
                {activeMapId && (
                  <Dropdown
                    trigger={<Button variant="ghost" size="sm"><HelpCircle className="h-4 w-4" /></Button>}
                    items={[
                      { label: 'Eliminar mapa', value: `delete-map-${activeMapId}`, danger: true },
                    ]}
                    onSelect={v => {
                      if (v.startsWith('delete-map-')) handleDeleteMap(v.replace('delete-map-', ''));
                    }}
                  />
                )}
              </div>
            </CardHeader>

            <CardBody className="p-0 relative">
              <div className="relative w-full h-[70vh] min-h-[500px] bg-surface-50">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full"
                  style={{ touchAction: 'none' }}
                />
                {selectedTool !== 'select' && (
                  <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur rounded-lg shadow-lg p-3 border border-surface-200">
                    <p className="text-sm font-medium text-surface-700 mb-2">
                      {selectedTool === 'rect' ? 'Rectángulo' : selectedTool === 'polygon' ? 'Polígono' : 'Ruta libre'}
                    </p>
                    <p className="text-xs text-surface-500">Click para agregar puntos. Enter para finalizar.</p>
                    <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => setSelectedTool('select')}>
                      <XCircle className="h-3.5 w-3.5 mr-1.5" /> Cancelar
                    </Button>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-surface-900">Zonas</h3>
                <Button size="sm" onClick={() => { setEditingZone(null); setShowZoneModal(true); }} disabled={!activeMapId}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Nueva
                </Button>
              </div>
            </CardHeader>
            <CardBody className="p-0 max-h-96 overflow-y-auto">
              {zones.length === 0 ? (
                <div className="p-6 text-center text-surface-500">
                  <Layers className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>No hay zonas definidas</p>
                  <p className="text-xs mt-1">Crea una zona para empezar</p>
                </div>
              ) : (
                <div className="divide-y divide-surface-100">
                  {zones.map(zone => {
                    const occ = getZoneOccupancy(zone);
                    const occColor = occ > 90 ? 'danger' : occ > 70 ? 'warning' : occ > 0 ? 'success' : 'neutral';
                    return (
                      <div
                        key={zone.id}
                        className="p-3 hover:bg-surface-50 transition-colors"
                        onClick={() => {
                          const canvas = fabricRef.current;
                          if (canvas) {
                            const obj = canvas.getObjects().find(o => (o as any).zoneId === zone.id);
                            if (obj) {
                              canvas.setActiveObject(obj);
                              canvas.renderAll();
                            }
                          }
                          setEditingZone(zone);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded"
                              style={{ backgroundColor: zone.color }}
                            />
                            <div>
                              <p className="font-medium text-sm text-surface-900">{zone.name}</p>
                              <p className="text-xs text-surface-500">{zone.locations.length} ubicaciones</p>
                            </div>
                          </div>
                          {showOccupancy && occ > 0 && (
                            <Badge variant={occColor as any} className="text-xs">
                              {occ}% ocupación
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Button variant="ghost" size="sm" className="flex-1" onClick={e => { e.stopPropagation(); setEditingZone(zone); }}>
                            <Edit className="h-3.5 w-3.5 mr-1.5" /> Editar
                          </Button>
                          <Button variant="ghost" size="sm" danger onClick={e => { e.stopPropagation(); handleDeleteZone(zone.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          {activeMapId && (
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-surface-900">Herramientas</h3>
              </CardHeader>
              <CardBody className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">Dibujar zona</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { tool: 'rect' as const, icon: Square, label: 'Rectángulo' },
                      { tool: 'polygon' as const, icon: Circle, label: 'Polígono' },
                      { tool: 'path' as const, icon: Move, label: 'Ruta libre' },
                    ].map(({ tool, icon: Icon, label }) => (
                      <Tooltip key={tool} content={label}>
                        <Button
                          variant={selectedTool === tool ? 'primary' : 'outline'}
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => setSelectedTool(selectedTool === tool ? 'select' : tool)}
                        >
                          <Icon className="h-4 w-4 mr-2" />
                          {label}
                        </Button>
                      </Tooltip>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-surface-200">
                  <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">Acciones rápidas</p>
                  <div className="space-y-2">
                    <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleDownloadSVG} disabled={!activeMapId}>
                      <Download className="h-3.5 w-3.5 mr-2" /> Exportar SVG
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleZoomReset}>
                      <RotateCcw className="h-3.5 w-3.5 mr-2" /> Zoom 100%
                    </Button>
                  </div>
                </div>

                <div className="pt-3 border-t border-surface-200">
                  <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">Leyenda ocupación</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded bg-green-500/30 border border-green-500" />
                      <span className="text-surface-600">0-70% - Normal</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded bg-yellow-500/30 border border-yellow-500" />
                      <span className="text-surface-600">70-90% - Advertencia</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded bg-red-500/30 border border-red-500" />
                      <span className="text-surface-600">90%+ - Crítico</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded bg-surface-200 border border-surface-300" />
                      <span className="text-surface-600">Sin datos</span>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nuevo Mapa de Depósito"
        description="Crea un nuevo plano para tu almacén"
      >
        <form onSubmit={e => { e.preventDefault(); handleCreateMap(new FormData(e.currentTarget)); }} className="space-y-4">
          <Input label="Nombre del mapa *" placeholder="Ej: Planta principal, Nivel 1, Zona fría" name="name" required />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" type="button" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={createMapMutation.isPending}>
              {createMapMutation.isPending ? 'Creando...' : 'Crear Mapa'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showZoneModal || !!editingZone}
        onClose={() => { setShowZoneModal(false); setEditingZone(null); }}
        title={editingZone ? `Editar Zona: ${editingZone.name}` : 'Nueva Zona'}
        description={editingZone ? 'Modifica las propiedades de la zona' : 'Dibuja la zona en el mapa y completa los datos'}
        size="lg"
      >
        {editingZone ? (
          <form onSubmit={e => { e.preventDefault(); handleUpdateZone(new FormData(e.currentTarget)); }} className="space-y-4">
            <Input label="Nombre *" name="name" defaultValue={editingZone.name} required />
            <Input label="Color (hex) *" name="color" type="color" defaultValue={editingZone.color} required />
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" type="button" onClick={() => { setEditingZone(null); setShowZoneModal(false); }}>Cancelar</Button>
              <Button variant="danger" type="button" onClick={() => handleDeleteZone(editingZone.id)}>Eliminar</Button>
              <Button type="submit" disabled={updateZoneMutation.isPending}>
                {updateZoneMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-surface-600">
              1. Selecciona la herramienta <strong>Polígono</strong> o <strong>Rectángulo</strong> en el panel derecho<br />
              2. Haz click en el mapa para definir los vértices de la zona<br />
              3. Presiona <kbd className="px-1.5 py-0.5 bg-surface-100 rounded text-xs font-mono">Enter</kbd> para finalizar el dibujo<br />
              4. Completa el formulario y guarda
            </p>
            <form onSubmit={e => { e.preventDefault(); handleCreateZone(new FormData(e.currentTarget)); }} className="space-y-4">
              <Input label="Nombre de la zona *" placeholder="Ej: Zona A - Recepción, Racks 1-10" name="name" required />
              <Input label="Color *" type="color" name="color" defaultValue={ZONE_COLORS[zones.length % ZONE_COLORS.length]} required />
              <input type="hidden" name="points" id="zone-points" value="[]" />
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" type="button" onClick={() => setShowZoneModal(false)}>Cancelar</Button>
                <Button type="submit" disabled={createZoneMutation.isPending}>
                  {createZoneMutation.isPending ? 'Creando...' : 'Crear Zona'}
                </Button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {mapLoading && activeMapId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl p-8 flex items-center gap-4 shadow-xl">
            <div className="animate-spin rounded-full h-8 w-8 border-3 border-primary-500 border-t-transparent" />
            <span className="text-surface-700">Cargando mapa...</span>
          </div>
        </div>
      )}
    </div>
  );
}