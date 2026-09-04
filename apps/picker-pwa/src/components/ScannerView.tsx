'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Vibration, Haptics, ImpactStyle } from '@capacitor/haptics';
import { MLKitBarcodeScanning, BarcodeFormat } from '@capacitor-community/mlkit-barcodescanning';
import { cn } from '@repo/ui/utils';
import { Button } from '@repo/ui/components';

interface ScannerViewProps {
  onScan: (code: string) => void;
  isActive: boolean;
  formats?: BarcodeFormat[];
  torchEnabled?: boolean;
  vibrationOnSuccess?: boolean;
  className?: string;
}

export function ScannerView({
  onScan,
  isActive,
  formats = [BarcodeFormat.Code128, BarcodeFormat.EAN13, BarcodeFormat.QRCode],
  torchEnabled = true,
  vibrationOnSuccess = true,
  className,
}: ScannerViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const lastScannedRef = useRef<string>('');

  const startScanning = useCallback(async () => {
    if (!videoRef.current || isScanning) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', torch: torchEnabled },
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setIsScanning(true);
      setError(null);

      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) return;

        try {
          const result = await MLKitBarcodeScanning.scan({
            image: videoRef.current,
            formats,
            torchEnabled,
          });

          if (result.barcodes.length > 0) {
            const code = result.barcodes[0].rawValue;
            if (code && code !== lastScannedRef.current) {
              lastScannedRef.current = code;
              if (vibrationOnSuccess) {
                await Haptics.impact({ style: ImpactStyle.Heavy });
                Vibration.vibrate({ duration: 100 });
              }
              onScan(code);
              setTimeout(() => { lastScannedRef.current = ''; }, 1000);
            }
          }
        } catch (err) {
          console.error('Scan error:', err);
        }
      }, 100);
    } catch (err) {
      setError('No se pudo acceder a la cámara. Verifica los permisos.');
      setPermission('denied');
      console.error('Camera error:', err);
    }
  }, [formats, onScan, torchEnabled, vibrationOnSuccess, isScanning]);

  const stopScanning = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = undefined;
    }
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }, []);

  useEffect(() => {
    if (isActive) {
      startScanning();
    } else {
      stopScanning();
    }
    return () => stopScanning();
  }, [isActive, startScanning, stopScanning]);

  useEffect(() => {
    const checkPermission = async () => {
      try {
        const perm = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setPermission(perm.state);
        perm.onchange = () => setPermission(perm.state);
      } catch {
        setPermission('prompt');
      }
    };
    checkPermission();
  }, []);

  if (permission === 'denied' || error) {
    return (
      <div className={cn('relative w-full aspect-square rounded-xl bg-surface-100 flex items-center justify-center', className)}>
        <div className="text-center p-6">
          <svg className="mx-auto h-16 w-16 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <p className="mt-4 text-lg font-medium text-surface-900">Cámara no disponible</p>
          <p className="mt-2 text-sm text-surface-500">{error || 'Permite el acceso a la cámara en la configuración del navegador'}</p>
          <Button variant="outline" className="mt-4" onClick={() => startScanning()}>Reintentar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative w-full aspect-square rounded-xl overflow-hidden bg-black', className)}>
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
        autoPlay
      />
      <canvas ref={canvasRef} className="hidden" />

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-64 h-64">
          <div className="absolute inset-0 border-4 border-primary-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.7)]" />
          <div className="scanner-line" />
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-center text-white">
            <p className="text-sm opacity-80">Apunta al código de barras</p>
            <p className="text-xs opacity-60">Se escaneará automáticamente</p>
          </div>
        </div>
      </div>

      {torchEnabled && (
        <button
          className="absolute bottom-4 right-4 z-10 rounded-full bg-white/90 p-3 shadow-lg backdrop-blur-sm"
          onClick={() => {
            if (videoRef.current?.srcObject) {
              const track = (videoRef.current.srcObject as MediaStream).getVideoTracks()[0];
              track.applyConstraints({ advanced: [{ torch: !track.getSettings().torch }] });
            }
          }}
          aria-label="Alternar linterna"
        >
          <svg className="h-6 w-6 text-surface-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </button>
      )}
    </div>
  );
}