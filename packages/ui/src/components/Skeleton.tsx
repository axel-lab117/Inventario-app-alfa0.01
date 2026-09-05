'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../utils';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = 'text', ...props }, ref) => (
    <div
      ref={ref}
      className={cn('skeleton', variant === 'text' ? 'skeleton-text' : variant === 'circular' ? 'skeleton-circular' : 'skeleton-rectangular', className)}
      {...props}
    />
  )
);

Skeleton.displayName = 'Skeleton';