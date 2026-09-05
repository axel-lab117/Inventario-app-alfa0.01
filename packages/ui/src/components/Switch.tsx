'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../utils';

interface SwitchProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, description, id, ...props }, ref) => {
    const switchId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex items-start gap-3">
        <div className="relative flex h-6 w-11 items-center rounded-full bg-surface-300 peer-focus:ring-2 peer-focus:ring-primary-500/20 peer-focus:outline-none transition-colors peer peer-checked:bg-primary-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed">
          <input
            ref={ref}
            type="checkbox"
            id={switchId}
            className="peer h-4 w-4 appearance-none rounded-full bg-white shadow-lg transition-transform peer-checked:translate-x-6"
            {...props}
          />
        </div>
        <div className="pt-1">
          {label && <label htmlFor={switchId} className="text-sm font-medium text-surface-900">{label}</label>}
          {description && <p className="text-xs text-surface-500 mt-0.5">{description}</p>}
        </div>
      </div>
    );
  }
);

Switch.displayName = 'Switch';