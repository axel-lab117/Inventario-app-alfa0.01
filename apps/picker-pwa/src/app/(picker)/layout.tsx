'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Package, Truck, RotateCcw, Box, LayoutDashboard, Settings, Menu, X, ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@repo/ui/components';
import { cn } from '@repo/ui/utils';

const navItems = [
  { href: '/picker', label: 'Inicio', icon: LayoutDashboard },
  { href: '/picker/scan', label: 'Escanear', icon: Box },
  { href: '/picker/tasks', label: 'Tareas', icon: Package },
  { href: '/picker/returns', label: 'Devoluciones', icon: RotateCcw },
  { href: '/picker/history', label: 'Historial', icon: Truck },
];

export default function PickerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isLoading, initialize, logout } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    initialize();
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [initialize]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-surface-50">
      <header className="sticky top-0 z-40 border-b border-surface-200 bg-white/80 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link href="/picker" className="text-xl font-bold text-primary-600">WMS Picker</Link>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    pathname === item.href
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <span className={cn('relative px-2 py-1 text-xs font-medium rounded-full', isOnline ? 'bg-success-100 text-success-800' : 'bg-warning-100 text-warning-800')}>
              {isOnline ? (
                <>
                  <span className="relative flex h-1.5 w-1.5 rounded-full bg-success-500" />
                  En línea
                </>
              ) : (
                'Sin conexión'
              )}
            </span>

            <div className="relative">
              <Button variant="ghost" size="sm" className="h-8 px-3" onClick={() => setShowMenu(!showMenu)}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary-700">{user.name.charAt(0)}</span>
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-surface-700">{user.name}</span>
                  <ChevronDown className="h-4 w-4 text-surface-500" />
                </div>
              </Button>

              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-surface-200 bg-white py-1 shadow-lg">
                  <div className="px-4 py-2 border-b border-surface-100">
                    <p className="text-sm font-medium text-surface-900">{user.name}</p>
                    <p className="text-xs text-surface-500">{user.tenantName}</p>
                    <p className="text-xs text-surface-400 capitalize">{user.role}</p>
                  </div>
                  <Link href="/picker/settings" className="flex items-center gap-2 px-4 py-2 text-sm text-surface-700 hover:bg-surface-50" onClick={() => setShowMenu(false)}>
                    <Settings className="h-4 w-4" />
                    Configuración
                  </Link>
                  <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-danger-600 hover:bg-surface-50" onClick={() => { logout(); setShowMenu(false); }}>
                    <RotateCcw className="h-4 w-4" />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>

            <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setShowMenu(!showMenu)}>
              {showMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      {showMenu && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setShowMenu(false)} />
      )}

      <main className="pb-20">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-surface-200 bg-white/95 backdrop-blur-sm md:hidden">
        <div className="grid grid-cols-5">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 py-3 px-2 text-xs font-medium transition-colors',
                pathname === item.href ? 'text-primary-600' : 'text-surface-500'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}