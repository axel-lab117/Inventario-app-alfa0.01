'use client';

import { forwardRef, useRef, useState, useEffect, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import { cn } from '../utils';
import { useOnClickOutside } from '../hooks';

interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  options: SelectOption[];
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
}

export const Select = forwardRef<HTMLDivElement, SelectProps>(
  ({ value, onValueChange, placeholder, options, disabled, className, triggerClassName, contentClassName }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const selectedOption = options.find(o => o.value === value);

    useOnClickOutside(contentRef, () => setIsOpen(false));
    useOnClickOutside(triggerRef, () => {}, { enabled: isOpen });

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (!isOpen) return;
        if (e.key === 'Escape') setIsOpen(false);
        if (e.key === 'ArrowDown') e.preventDefault();
        if (e.key === 'ArrowUp') e.preventDefault();
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    const handleSelect = (optionValue: string) => {
      onValueChange(optionValue);
      setIsOpen(false);
    };

    return (
      <div ref={ref} className={cn('relative inline-block w-full', className)}>
        <button
          ref={triggerRef}
          type="button"
          className={cn(
            'select-trigger w-full flex items-center justify-between px-3 py-2.5 text-sm',
            'rounded-lg border border-surface-300 bg-white',
            'placeholder:text-surface-400',
            'hover:border-primary-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
            'disabled:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-50',
            'transition-colors',
            triggerClassName
          )}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className={cn('truncate pr-8', !selectedOption && !placeholder && 'text-surface-400')}>
            {selectedOption?.label || placeholder || 'Seleccionar'}
          </span>
          {isOpen ? <ChevronUp className="h-4 w-4 flex-shrink-0 text-surface-500" /> : <ChevronDown className="h-4 w-4 flex-shrink-0 text-surface-500" />}
        </button>

        {isOpen && (
          <div
            ref={contentRef}
            className={cn(
              'select-content absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-surface-200 bg-white shadow-lg ring-1 ring-black/5',
              contentClassName
            )}
            role="listbox"
          >
            {options.map(option => (
              <button
                key={option.value}
                role="option"
                aria-selected={value === option.value}
                className={cn(
                  'select-item w-full px-3 py-2 text-sm text-left',
                  'hover:bg-surface-50 focus:bg-surface-50',
                  option.disabled && 'opacity-50 cursor-not-allowed',
                  value === option.value && 'bg-primary-50 text-primary-700'
                )}
                disabled={option.disabled}
                onClick={() => !option.disabled && handleSelect(option.value)}
              >
                <span className="flex-1">{option.label}</span>
                {value === option.value && <Check className="h-4 w-4 text-primary-600" />}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

interface SelectTriggerProps {
  children: ReactNode;
  className?: string;
}

export const SelectTrigger = forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ children, className }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'select-trigger w-full flex items-center justify-between px-3 py-2.5 text-sm',
        'rounded-lg border border-surface-300 bg-white',
        'placeholder:text-surface-400',
        'hover:border-primary-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
        'disabled:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-50',
        'transition-colors',
        className
      )}
    >
      {children}
    </button>
  )
);
SelectTrigger.displayName = 'SelectTrigger';

interface SelectValueProps {
  placeholder?: string;
  children?: ReactNode;
}

export const SelectValue = ({ placeholder, children }: SelectValueProps) => (
  <span className={cn('truncate pr-8', !children && placeholder && 'text-surface-400')}>
    {children || placeholder || 'Seleccionar'}
  </span>
);

interface SelectContentProps {
  children: ReactNode;
  className?: string;
}

export const SelectContent = ({ children, className }: SelectContentProps) => (
  <div
    className={cn(
      'select-content absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-surface-200 bg-white shadow-lg ring-1 ring-black/5',
      className
    )}
    role="listbox"
  >
    {children}
  </div>
);

interface SelectItemProps {
  value: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

export const SelectItem = forwardRef<HTMLButtonElement, SelectItemProps>(
  ({ value, children, disabled, className }, ref) => (
    <button
      ref={ref}
      role="option"
      type="button"
      className={cn(
        'select-item w-full px-3 py-2 text-sm text-left',
        'hover:bg-surface-50 focus:bg-surface-50',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      disabled={disabled}
    >
      {children}
    </button>
  )
);
SelectItem.displayName = 'SelectItem';