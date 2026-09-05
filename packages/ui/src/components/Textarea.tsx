'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && <label htmlFor={textareaId} className="label">{label}</label>}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'input min-h-[100px] resize-y',
            'placeholder:text-surface-400',
            error && 'input-error',
            className
          )}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined}
          {...props}
        />
        {error && <p id={`${textareaId}-error`} className="mt-1 text-sm text-danger-600" role="alert">{error}</p>}
        {helperText && !error && <p id={`${textareaId}-helper`} className="mt-1 text-sm text-surface-500">{helperText}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';