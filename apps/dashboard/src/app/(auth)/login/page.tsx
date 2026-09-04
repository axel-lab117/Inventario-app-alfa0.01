'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Card, CardBody, CardHeader } from '@repo/ui/components';
import { useAuthStore } from '@/lib/auth-store';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  rememberMe: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: true },
  });

  const onSubmit = async (data: LoginForm) => {
    setError('');
    try {
      await login(data.email, data.password, data.rememberMe);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Credenciales inválidas');
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <h1 className="text-2xl font-bold text-surface-900">Iniciar Sesión</h1>
        <p className="mt-2 text-sm text-surface-500">Ingresa tus credenciales para acceder</p>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-700" role="alert">
              {error}
            </div>
          )}

          <Input
            label="Email"
            type="email"
            placeholder="usuario@empresa.com"
            autoComplete="email"
            {...register('email')}
            error={errors.email?.message}
            disabled={isLoading}
          />

          <div className="relative">
            <Input
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
              {...register('password')}
              error={errors.password?.message}
              disabled={isLoading}
            />
            <button
              type="button"
              className="absolute right-3 top-[38px] text-surface-400 hover:text-surface-600"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('rememberMe')} className="rounded border-surface-300 text-primary-600 focus:ring-primary-500" />
              <span className="text-sm text-surface-700">Recordarme</span>
            </label>
            <Link href="/auth/forgot-password" className="text-sm text-primary-600 hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <Button type="submit" className="w-full" loading={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4" /> : 'Ingresar'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-surface-500">
          ¿No tienes cuenta? <Link href="/auth/register" className="text-primary-600 hover:underline font-medium">Regístrate</Link>
        </div>
      </CardBody>
    </Card>
  );
}