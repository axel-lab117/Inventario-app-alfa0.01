'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && <label htmlFor={inputId} className="label">{label}</label>}
        <input
          ref={ref}
          id={inputId}
          className={cn('input', error && 'input-error', className)}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...props}
        />
        {error && <p id={`${inputId}-error`} className="mt-1 text-sm text-danger-600" role="alert">{error}</p>}
        {helperText && !error && <p id={`${inputId}-helper`} className="mt-1 text-sm text-surface-500">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';