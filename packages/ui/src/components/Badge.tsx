'use client';

import { cn } from '../utils';

interface BadgeProps {
  className?: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  children: React.ReactNode;
}

export function Badge({ className, variant = 'neutral', children }: BadgeProps) {
  const variantClasses = {
    primary: 'badge-primary',
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    neutral: 'badge-neutral',
  };

  return <span className={cn('badge', variantClasses[variant], className)}>{children}</span>;
}