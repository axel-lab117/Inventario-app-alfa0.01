'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn('card', className)} {...props}>{children}</div>
));

Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, CardProps>(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn('card-header', className)} {...props}>{children}</div>
));

CardHeader.displayName = 'CardHeader';

export const CardBody = forwardRef<HTMLDivElement, CardProps>(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn('card-body', className)} {...props}>{children}</div>
));

CardBody.displayName = 'CardBody';

export const CardFooter = forwardRef<HTMLDivElement, CardProps>(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn('card-footer', className)} {...props}>{children}</div>
));

CardFooter.displayName = 'CardFooter';