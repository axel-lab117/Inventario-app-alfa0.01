import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './styles/globals.css';
import { ToastProvider } from '@repo/ui/components';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'WMS - Gestión de Inventario',
  description: 'Sistema de gestión de almacén multi-tenant',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}