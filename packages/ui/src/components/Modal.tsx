'use client';

import { Fragment, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../utils';
import { Button } from './Button';
import { useOnClickOutside } from '../hooks';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-4xl',
};

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(overlayRef, closeOnOverlayClick ? onClose : () => {});
  useOnClickOutside(contentRef, () => {});

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  return (
    <Fragment>
      <div
        ref={overlayRef}
        className="modal-overlay"
        aria-hidden="true"
      />
      <div
        ref={contentRef}
        className={cn('modal-content', sizeClasses[size])}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={description ? 'modal-description' : undefined}
      >
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              {title && <h2 id="modal-title" className="text-lg font-semibold text-surface-900">{title}</h2>}
              {description && <p id="modal-description" className="mt-1 text-sm text-surface-500">{description}</p>}
            </div>
            {showCloseButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                aria-label="Cerrar modal"
                className="-m-1 p-1"
              >
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        )}
        <div>{children}</div>
      </div>
    </Fragment>
  );
}

import { useRef, useEffect } from 'react';