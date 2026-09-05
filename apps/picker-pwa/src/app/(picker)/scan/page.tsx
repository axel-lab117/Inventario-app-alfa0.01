'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera, X, CheckCircle, AlertCircle, Clock, WifiOff, Wifi,
  Settings, History, Package, Box, RefreshCw, Loader2,
  Vibrate, Smartphone, ExternalLink, Flashlight, Zap
} from 'lucide-react';
import {
  Card, CardHeader, CardBody, Button, Badge, Input,
  Modal, Tooltip, Separator
} from '@repo/ui/components';
import { useToast } from '@repo/ui/components';
import { useAuthStore } from '@/lib/auth-store';
import { api, setAuthToken, setTenantId } from '@/lib/api';
import { addMovement, getPendingMovements, markMovementSynced, getDB } from '@/lib/idb';
import { requestBackgroundSync } from '@/lib/sw-register';

const SCAN_FORMAT = /^BOX-([A-Z0-9-]+)-(\d+)$/;

function parseBoxCode(code: string) {
  const match = code.match(SCAN_FORMAT);
  if (!match) return null;
  return { sku: match[1], sequence: parseInt(match[2], 10) };
}

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

declare global {
  interface Window {
    Capacitor?: any;
    BarcodeDetector?: any;
  }
}

function isCapacitorNative(): boolean {
  return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform();
}

export default function ScanPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, token, tenantId, initialize } = useAuthStore();

  const [isOnline, setIsOnline] = useState(true);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [useNativeScanner, setUseNativeScanner] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [scanResult, setScanResult] = useState<{ code: string; parsed: any; timestamp: number } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [scanHistory, setScanHistory] = useState<Array<{ code: string; status: 'pending' | 'synced' | 'failed'; timestamp: number; error?: string }>>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout>();
  const animationFrameRef = useRef<number>();
  const barcodeScannerRef = useRef<any>(null);

  useEffect(() => {
    initialize();
    if (token) setAuthToken(token);
    if (tenantId) setTenantId(tenantId);
    checkCameraPermission();
    loadPendingCount();
    loadScanHistory();
    setupOnlineListener();
    checkNativeScanner();
  }, [initialize, token, tenantId]);

  const checkNativeScanner = async () => {
    if (isCapacitorNative()) {
      try {
        const { BarcodeScanner } = await import('@capacitor-community/barcode-scanner');
        const available = await BarcodeScanner.checkPermission({ force: true });
        if (available.granted) {
          setUseNativeScanner(true);
        }
      } catch (e) {
        console.log('Native barcode scanner not available:', e);
      }
    }
  };

  const setupOnlineListener = () => {
    const handleOnline = () => { setIsOnline(true); loadPendingCount(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  };

  const checkCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach(t => t.stop());
      setHasCameraPermission(true);
    } catch {
      setHasCameraPermission(false);
      toast({ title: 'Permiso de cámara requerido', description: 'Activa el permiso en la configuración del navegador', type: 'error' });
    }
  };

  const loadPendingCount = async () => {
    try {
      const pending = await getPendingMovements();
      setPendingCount(pending.length);
    } catch (e) {
      console.error('Error loading pending:', e);
    }
  };

  const loadScanHistory = async () => {
    try {
      const db = await getDB();
      const all = await db.getAllFromIndex('movements', 'by-timestamp');
      setScanHistory(all.slice(-50).reverse().map(m => ({
        code: m.boxCode,
        status: m.pending ? 'pending' : m.syncedAt ? 'synced' : 'failed',
        timestamp: m.timestamp,
      })));
    } catch (e) {
      console.error('Error loading history:', e);
    }
  };

  const startScanning = useCallback(async () => {
    if (useNativeScanner) {
      await startNativeScanning();
    } else {
      await startWebScanning();
    }
  }, [useNativeScanner]);

  const startNativeScanning = async () => {
    try {
      const { BarcodeScanner } = await import('@capacitor-community/barcode-scanner');
      
      await BarcodeScanner.prepare();
      document.body.classList.add('scanner-active');
      
      const result = await BarcodeScanner.startScan();
      
      if (result.hasContent) {
        handleScanResult(result.content);
      }
      
      await stopNativeScanning();
    } catch (err) {
      console.error('Native scan error:', err);
      setLastError('Error en escáner nativo');
      toast({ title: 'Error escáner', description: String(err), type: 'error' });
      await stopNativeScanning();
    }
  };

  const stopNativeScanning = async () => {
    try {
      const { BarcodeScanner } = await import('@capacitor-community/barcode-scanner');
      await BarcodeScanner.stopScan();
      document.body.classList.remove('scanner-active');
      setIsScanning(false);
    } catch (e) {
      console.error('Stop native scan error:', e);
    }
  };

  const startWebScanning = async () => {
    if (!hasCameraPermission) { await checkCameraPermission(); return; }
    if (!videoRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setIsScanning(true);
      setLastError(null);
      scanLoop();
    } catch (err) {
      console.error('Camera error:', err);
      setLastError('No se pudo acceder a la cámara');
      toast({ title: 'Error de cámara', description: String(err), type: 'error' });
    }
  };

  const stopScanning = useCallback(async () => {
    if (useNativeScanner) {
      await stopNativeScanning();
    } else {
      setIsScanning(false);
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
    }
  }, [useNativeScanner]);

  const scanLoop = () => {
    if (!isScanning || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      animationFrameRef.current = requestAnimationFrame(scanLoop);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      if ('BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({ 
            formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code'] 
          });
          const barcodes = await detector.detect(imageData);
          if (barcodes.length > 0) {
            handleScanResult(barcodes[0].rawValue);
            return;
          }
        } catch { /* fallback */ }
      }
    } catch (e) {
      console.debug('Scan frame error:', e);
    }

    animationFrameRef.current = requestAnimationFrame(scanLoop);
  };

  const handleScanResult = async (rawCode: string) => {
    await stopScanning();
    
    const parsed = parseBoxCode(rawCode);
    if (!parsed) {
      setLastError(`Formato inválido: ${rawCode}. Esperado: BOX-SKU-SEQ`);
      toast({ title: 'Código inválido', description: 'Formato: BOX-SKU-1234', type: 'error' });
      vibrate('error');
      setTimeout(startScanning, 2000);
      return;
    }

    const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const movement = {
      id: idempotencyKey,
      boxCode: rawCode,
      sku: parsed.sku,
      type: 'REMOVE' as const,
      quantity: 1,
      locationId: user?.tenantId || '',
      employeeId: user?.id || '',
      timestamp: Date.now(),
      pending: true,
      idempotencyKey,
    };

    try {
      await addMovement(movement);
      setScanResult({ code: rawCode, parsed, timestamp: Date.now() });
      setShowResultModal(true);
      setPendingCount(c => c + 1);
      vibrate('success');
      toast({ title: 'Escaneado guardado', description: `${rawCode} - Pendiente de sincronización`, type: 'success' });
      
      if (isOnline) {
        await flushPending();
      }
    } catch (err) {
      console.error('Save scan error:', err);
      toast({ title: 'Error guardando', type: 'error' });
    }
  };

  const flushPending = async () => {
    if (!isOnline) return;
    
    try {
      const pending = await getPendingMovements();
      for (const movement of pending) {
        try {
          const response = await api.post('/inventory/scan/remove', {
            boxCode: movement.boxCode,
            locationId: movement.locationId,
          }, {
            headers: { 'x-idempotency-key': movement.idempotencyKey }
          });
          
          if (response.status === 200 || response.status === 409) {
            await markMovementSynced(movement.id);
            setPendingCount(c => Math.max(0, c - 1));
          }
        } catch (err) {
          console.error('Sync failed for:', movement.id, err);
        }
      }
      await loadScanHistory();
    } catch (err) {
      console.error('Flush error:', err);
    }
  };

  const forceSync = async () => {
    if (!isOnline) {
      toast({ title: 'Sin conexión', description: 'No se puede sincronizar offline', type: 'warning' });
      return;
    }
    toast({ title: 'Sincronizando...', type: 'info' });
    await flushPending();
    toast({ title: 'Sincronización completada', type: 'success' });
  };

  const vibrate = (type: 'success' | 'error' | 'warning') => {
    if (isCapacitorNative()) {
      try {
        const { Haptics } = await import('@capacitor/haptics');
        const patterns = {
          success: { type: 'SUCCESS' },
          error: { type: 'ERROR' },
          warning: { type: 'WARNING' },
        };
        await Haptics.impact(patterns[type]);
      } catch { /* fallback */ }
    }
    if (!('vibrate' in navigator)) return;
    const patterns = {
      success: [100, 50, 100],
      error: [200, 100, 200, 100, 200],
      warning: [300, 100, 300],
    };
    navigator.vibrate(patterns[type]);
  };

  const handleManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const code = formData.get('code') as string?.trim().toUpperCase();
    if (!code) return;
    handleScanResult(code);
    (e.target as HTMLFormElement).reset();
  };

  const toggleTorch = async () => {
    if (useNativeScanner) {
      try {
        const { BarcodeScanner } = await import('@capacitor-community/barcode-scanner');
        await BarcodeScanner.toggleTorch();
        setTorchOn(!torchOn);
      } catch (e) {
        console.error('Torch toggle error:', e);
      }
    } else {
      // Web torch not widely supported
      toast({ title: 'Linterna solo en app nativa', type: 'info' });
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <header className="sticky top-0 z-40 border-b border-surface-200 bg-white/80 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-primary-600">WMS Picker</span>
            <span className="hidden sm:block text-sm text-surface-500 px-2 py-1 rounded-full bg-surface-100">
              {user.tenantName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip content={isOnline ? 'En línea' : 'Sin conexión - Modo offline'}>
              <span className={`relative px-2 py-1 text-xs font-medium rounded-full ${
                isOnline ? 'bg-success-100 text-success-800' : 'bg-warning-100 text-warning-800'
              }`}>
                {isOnline ? (
                  <>
                    <span className="relative flex h-1.5 w-1.5 rounded-full bg-success-500 mr-1" />
                    En línea
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 mr-1" />
                    Offline
                  </>
                )}
              </span>
            </Tooltip>
            {pendingCount > 0 && (
              <Tooltip content={`${pendingCount} escaneos pendientes`}>
                <Badge variant="warning" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {pendingCount}
                </Badge>
              </Tooltip>
            )}
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(true)}>
              <History className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-md mx-auto space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-surface-900">Escáner de Cajas</h2>
              <Badge variant={isScanning ? 'success' : 'neutral'}>
                {isScanning ? <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Escaneando</span> : 'Listo'}
              </Badge>
            </div>
            <p className="text-sm text-surface-500 mt-1">
              Apunta la cámara al código de la caja <code className="bg-surface-100 px-1 rounded text-xs">BOX-SKU-1234</code>
            </p>
          </CardHeader>
          <CardBody className="p-0 relative">
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
              {useNativeScanner ? (
                <div className="w-full h-full flex items-center justify-center bg-black text-white p-4">
                  <div className="text-center">
                    <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Escáner Nativo Activo</p>
                    <p className="text-sm opacity-75 mt-1">La cámara se abrirá en pantalla completa</p>
                    <Button variant="outline" className="mt-4 w-full max-w-xs" onClick={stopScanning}>
                      <X className="h-4 w-4 mr-2" /> Detener
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-0" />
                  
                  {isScanning && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="relative w-3/4 aspect-square">
                        <div className="absolute inset-0 border-4 border-primary-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.7)]" />
                        <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-primary-500 animate-[scan_2s_linear_infinite]" style={{ animation: 'scan 2s linear infinite' }} />
                      </div>
                    </div>
                  )}
                  
                  {!hasCameraPermission && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 text-white p-4">
                      <Camera className="h-16 w-16 opacity-50" />
                      <div className="text-center">
                        <p className="text-lg font-medium">Permiso de cámara requerido</p>
                        <p className="text-sm opacity-75">Activa el acceso a la cámara en tu navegador</p>
                      </div>
                      <Button onClick={checkCameraPermission} className="w-full max-w-xs">
                        <Camera className="h-4 w-4 mr-2" /> Solicitar Permiso
                      </Button>
                    </div>
                  )}
                  
                  {lastError && (
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="bg-danger-600/90 text-white px-4 py-2 rounded-lg text-sm">
                        {lastError}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-4 space-y-3">
              <form onSubmit={handleManualEntry} className="flex gap-2">
                <Input
                  name="code"
                  placeholder="Ingresar código manualmente (BOX-SKU-1234)"
                  className="flex-1"
                  autoComplete="off"
                  disabled={isScanning}
                />
                <Button type="submit" disabled={isScanning}>
                  <Package className="h-4 w-4 mr-2" /> Procesar
                </Button>
              </form>

              <div className="grid grid-cols-3 gap-2 text-center">
                <Tooltip content="Historial de escaneos">
                  <Button variant="outline" size="sm" className="h-auto py-3" onClick={() => setShowHistory(true)}>
                    <History className="h-5 w-5 mx-auto mb-1" />
                    <span className="block text-xs">Historial</span>
                    <Badge variant="neutral" className="mt-1">{scanHistory.length}</Badge>
                  </Button>
                </Tooltip>
                <Tooltip content={`Sincronizar ${pendingCount} pendientes`}>
                  <Button 
                    variant={pendingCount > 0 ? 'primary' : 'outline'} 
                    size="sm" 
                    className="h-auto py-3"
                    onClick={forceSync}
                    disabled={pendingCount === 0 || !isOnline}
                  >
                    <RefreshCw className="h-5 w-5 mx-auto mb-1" />
                    <span className="block text-xs">Sincronizar</span>
                    {pendingCount > 0 && <Badge variant="warning" className="mt-1">{pendingCount}</Badge>}
                  </Button>
                </Tooltip>
                <Tooltip content="Configuración">
                  <Button variant="outline" size="sm" className="h-auto py-3" onClick={() => setShowSettings(true)}>
                    <Settings className="h-5 w-5 mx-auto mb-1" />
                    <span className="block text-xs">Ajustes</span>
                  </Button>
                </Tooltip>
              </div>
              
              {useNativeScanner && (
                <div className="pt-2">
                  <Button variant="outline" size="sm" className="w-full" onClick={toggleTorch}>
                    {torchOn ? <Flashlight className="h-4 w-4 mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                    {torchOn ? 'Apagar Linterna' : 'Encender Linterna'}
                  </Button>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {scanHistory.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <h3 className="font-semibold text-surface-900">Últimos Escaneos</h3>
            </CardHeader>
            <CardBody className="p-0 max-h-60 overflow-y-auto">
              <div className="divide-y divide-surface-100">
                {scanHistory.slice(0, 10).map((scan, i) => (
                  <div key={i} className="p-3 flex items-center justify-between hover:bg-surface-50">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${scan.status === 'synced' ? 'bg-success-500' : scan.status === 'pending' ? 'bg-warning-500' : 'bg-danger-500'}`} />
                      <div>
                        <p className="font-mono text-sm font-medium">{scan.code}</p>
                        <p className="text-xs text-surface-500">{formatRelativeTime(scan.timestamp)}</p>
                      </div>
                    </div>
                    <Badge variant={
                      scan.status === 'synced' ? 'success' : 
                      scan.status === 'pending' ? 'warning' : 'danger'
                    } className="text-xs">
                      {scan.status === 'synced' ? 'Sincronizado' : scan.status === 'pending' ? 'Pendiente' : 'Fallido'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}
      </main>

      <ResultModal
        isOpen={showResultModal}
        onClose={() => { setShowResultModal(false); setScanResult(null); setTimeout(startScanning, 1000); }}
        result={scanResult}
      />

      <HistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        history={scanHistory}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        isOnline={isOnline}
        pendingCount={pendingCount}
        onForceSync={forceSync}
        useNativeScanner={useNativeScanner}
        setUseNativeScanner={setUseNativeScanner}
      />
    </div>
  );
}

function ResultModal({ isOpen, onClose, result }: { isOpen: boolean; onClose: () => void; result: any }) {
  if (!isOpen || !result) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Escaneo Exitoso" size="md">
      <div className="space-y-4 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-success-100 flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-success-600" />
        </div>
        <div>
          <p className="font-mono text-lg font-semibold">{result.code}</p>
          <p className="text-sm text-surface-500 mt-1">
            SKU: {result.parsed.sku} · Secuencia: {result.parsed.sequence}
          </p>
        </div>
        <div className="p-3 bg-surface-100 rounded-lg text-sm">
          <p className="text-surface-600">Guardado localmente</p>
          <p className="text-surface-500">Se sincronizará automáticamente al estar en línea</p>
        </div>
        <Button className="w-full" onClick={onClose}>Continuar Escaneando</Button>
      </div>
    </Modal>
  );
}

function HistoryModal({ isOpen, onClose, history }: { isOpen: boolean; onClose: () => void; history: any[] }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Historial de Escaneos" size="lg">
      <div className="max-h-96 overflow-y-auto">
        {history.length === 0 ? (
          <div className="p-8 text-center text-surface-500">
            <Box className="h-16 w-16 mx-auto mb-4 text-surface-300" />
            <p>No hay escaneos registrados</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100">
            {history.map((scan, i) => (
              <div key={i} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${scan.status === 'synced' ? 'bg-success-500' : scan.status === 'pending' ? 'bg-warning-500' : 'bg-danger-500'}`} />
                  <div>
                    <p className="font-mono text-sm font-medium">{scan.code}</p>
                    <p className="text-xs text-surface-500">{formatRelativeTime(scan.timestamp)}</p>
                  </div>
                </div>
                <Badge variant={
                  scan.status === 'synced' ? 'success' : 
                  scan.status === 'pending' ? 'warning' : 'danger'
                } className="text-xs">
                  {scan.status === 'synced' ? 'Sincronizado' : scan.status === 'pending' ? 'Pendiente' : 'Fallido'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-surface-200">
        <Button variant="outline" onClick={onClose}>Cerrar</Button>
      </div>
    </Modal>
  );
}

function SettingsModal({ isOpen, onClose, isOnline, pendingCount, onForceSync, useNativeScanner, setUseNativeScanner }: { isOpen: boolean; onClose: () => void; isOnline: boolean; pendingCount: number; onForceSync: () => void; useNativeScanner: boolean; setUseNativeScanner: (v: boolean) => void }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configuración" size="md">
      <div className="space-y-6">
        <div>
          <h4 className="font-medium text-surface-900 mb-3">Estado de Conexión</h4>
          <div className="flex items-center justify-between p-3 bg-surface-50 rounded-lg">
            <div className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-success-500' : 'bg-warning-500'}`} />
              <span>{isOnline ? 'En línea' : 'Sin conexión (Offline)'}</span>
            </div>
            <Badge variant={isOnline ? 'success' : 'warning'}>{isOnline ? 'Conectado' : 'Offline'}</Badge>
          </div>
        </div>

        <div>
          <h4 className="font-medium text-surface-900 mb-3">Escaneos Pendientes</h4>
          <div className="flex items-center justify-between p-3 bg-surface-50 rounded-lg">
            <span>{pendingCount} en cola</span>
            <Button onClick={onForceSync} disabled={pendingCount === 0 || !isOnline}>
              <RefreshCw className="h-4 w-4 mr-2" /> Sincronizar Ahora
            </Button>
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="font-medium text-surface-900 mb-3">Modo Escáner</h4>
          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 bg-surface-50 rounded-lg cursor-pointer">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-surface-400" />
                <div>
                  <p className="font-medium text-surface-900">Escáner Nativo (Capacitor)</p>
                  <p className="text-xs text-surface-500">Usa ML Kit / CameraX - Mejor rendimiento</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={useNativeScanner}
                onChange={e => setUseNativeScanner(e.target.checked)}
                className="h-4 w-4 text-primary-600 rounded border-surface-300 focus:ring-primary-500"
                disabled={!isCapacitorNative()}
              />
            </label>
            {!isCapacitorNative() && (
              <p className="text-xs text-surface-500 text-center py-2">
                Disponible solo en app instalada (Android/iOS)
              </p>
            )}
            <label className="flex items-center justify-between p-3 bg-surface-50 rounded-lg cursor-pointer">
              <div className="flex items-center gap-3">
                <Camera className="h-5 w-5 text-surface-400" />
                <div>
                  <p className="font-medium text-surface-900">Escáner Web (BarcodeDetector API)</p>
                  <p className="text-xs text-surface-500">Chrome 88+ - Funciona en navegador</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={!useNativeScanner}
                onChange={e => setUseNativeScanner(!e.target.checked)}
                className="h-4 w-4 text-primary-600 rounded border-surface-300 focus:ring-primary-500"
              />
            </label>
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="font-medium text-surface-900 mb-3">Información</h4>
          <div className="space-y-2 text-sm text-surface-600">
            <p>• Formato código: <code className="bg-surface-100 px-1 rounded">BOX-SKU-1234</code></p>
            <p>• Los escaneos se guardan offline automáticamente</p>
            <p>• Sincronización en segundo plano al recuperar conexión</p>
            <p>• Clave de idempotencia evita duplicados</p>
          </div>
        </div>

        <div className="pt-4 border-t border-surface-200">
          <Button variant="outline" className="w-full" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </Modal>
  );
}

const style = document.createElement('style');
style.textContent = `
  @keyframes scan {
    0% { top: 0; opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { top: 100%; opacity: 0; }
  }
  .scanner-active { background: black; }
  .scanner-active video { display: none; }
`;
if (typeof document !== 'undefined') document.head.appendChild(style);