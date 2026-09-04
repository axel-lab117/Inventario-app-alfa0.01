'use client';

import { forwardRef, type HTMLAttributes, type TableHTMLAttributes } from 'react';
import { cn } from '../utils';

interface TableProps extends TableHTMLAttributes<HTMLTableElement> {}

export const Table = forwardRef<HTMLTableElement, TableProps>(({ className, children, ...props }, ref) => (
  <div className="table-container">
    <table ref={ref} className={cn('table', className)} {...props}>{children}</table>
  </div>
));

Table.displayName = 'Table';

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, children, ...props }, ref) => (
    <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props}>{children}</thead>
  )
);

TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, children, ...props }, ref) => (
    <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props}>{children}</tbody>
  )
);

TableBody.displayName = 'TableBody';

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className, children, ...props }, ref) => (
    <tr ref={ref} className={cn('', className)} {...props}>{children}</tr>
  )
);

TableRow.displayName = 'TableRow';

export const TableHead = forwardRef<HTMLTableCellElement, HTMLAttributes<HTMLTableCellElement>>(
  ({ className, children, ...props }, ref) => (
    <th ref={ref} className={cn('', className)} {...props}>{children}</th>
  )
);

TableHead.displayName = 'TableHead';

export const TableCell = forwardRef<HTMLTableCellElement, HTMLAttributes<HTMLTableCellElement>>(
  ({ className, children, ...props }, ref) => (
    <td ref={ref} className={cn('', className)} {...props}>{children}</td>
  )
);

TableCell.displayName = 'TableCell';