'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isLoading && !user && !pathname.startsWith('/auth')) {
      router.push('/auth/login');
    }
    if (!isLoading && user && pathname.startsWith('/auth')) {
      router.push('/dashboard');
    }
  }, [user, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-surface-50">
      <header className="sticky top-0 z-40 border-b border-surface-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <a href="/dashboard" className="text-xl font-bold text-primary-600">WMS</a>
              <nav className="hidden md:flex items-center gap-6">
                <a href="/dashboard" className="text-sm font-medium text-surface-700 hover:text-primary-600">Dashboard</a>
                <a href="/dashboard/inventory" className="text-sm font-medium text-surface-700 hover:text-primary-600">Inventario</a>
                <a href="/dashboard/warehouse" className="text-sm font-medium text-surface-700 hover:text-primary-600">Galpón</a>
                <a href="/dashboard/orders" className="text-sm font-medium text-surface-700 hover:text-primary-600">Órdenes</a>
                <a href="/dashboard/returns" className="text-sm font-medium text-surface-700 hover:text-primary-600">Devoluciones</a>
                <a href="/dashboard/marketplaces" className="text-sm font-medium text-surface-700 hover:text-primary-600">Marketplaces</a>
                <a href="/dashboard/analytics" className="text-sm font-medium text-surface-700 hover:text-primary-600">Analítica</a>
                <a href="/dashboard/settings" className="text-sm font-medium text-surface-700 hover:text-primary-600">Configuración</a>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:block text-sm text-surface-500">{user.tenantName}</div>
              <button className="btn-ghost btn-sm" onClick={() => router.push('/dashboard/settings')}>
                {user.name}
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}