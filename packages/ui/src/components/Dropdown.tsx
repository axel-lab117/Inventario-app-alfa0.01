'use client';

import { useRef, useState, useEffect, type ReactNode } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../utils';
import { Button } from './Button';
import { useOnClickOutside } from '../hooks';

interface DropdownItem {
  label: string;
  value: string;
  icon?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
}

interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  onSelect: (value: string) => void;
  selectedValue?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Dropdown({ trigger, items, onSelect, selectedValue, placeholder, disabled, className }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useOnClickOutside(dropdownRef, () => setIsOpen(false));

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

  const handleItemClick = (value: string) => {
    onSelect(value);
    setIsOpen(false);
  };

  const selectedItem = items.find(i => i.value === selectedValue);

  return (
    <div ref={dropdownRef} className={cn('relative inline-block', className)}>
      <Button
        ref={buttonRef}
        variant="outline"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full justify-between"
      >
        <span className={cn('truncate', !selectedItem && !placeholder && 'text-surface-400')}>
          {selectedItem?.label || placeholder || 'Seleccionar'}
        </span>
        <ChevronDown className={cn('h-4 w-4 flex-shrink-0', isOpen && 'rotate-180')} />
      </Button>

      {isOpen && (
        <div className="dropdown" role="menu">
          {items.map(item => (
            <button
              key={item.value}
              role="menuitem"
              className={cn(
                'dropdown-item w-full text-left',
                item.disabled && 'opacity-50 cursor-not-allowed',
                item.danger && 'text-danger-600 hover:bg-danger-50'
              )}
              disabled={item.disabled}
              onClick={() => !item.disabled && handleItemClick(item.value)}
            >
              {item.icon && <span className="h-4 w-4">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
              {selectedValue === item.value && <Check className="h-4 w-4 text-primary-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}