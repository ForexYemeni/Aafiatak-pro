'use client';

import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnResizeMode,
} from '@tanstack/react-table';
import {
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  MoreHorizontal,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface RowAction {
  label: string;
  onClick: (row: Record<string, unknown>) => void;
  variant?: 'default' | 'destructive';
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyAction?: {
    label: string;
    onClick: () => void;
  };
  rowActions?: RowAction[];
  onRowClick?: (row: TData) => void;
  pageSize?: number;
  pageCount?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onSortingChange?: (sorting: SortingState) => void;
  className?: string;
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-10 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function TableEmpty({
  message,
  action,
}: {
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <MoreHorizontal className="w-8 h-8 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground text-sm mb-4">{message}</p>
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// DataTable Component
// ============================================================================

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'لا توجد بيانات للعرض',
  emptyAction,
  rowActions = [],
  onRowClick,
  pageSize = 10,
  pageCount,
  currentPage = 1,
  onPageChange,
  onSortingChange,
  className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const tableColumns = useMemo(() => {
    if (rowActions.length === 0) return columns;

    const result = [
      ...columns,
      {
        id: 'actions',
        header: () => null,
        cell: ({ row }: { row: { original: TData } }) => {
          const rowData = row.original as unknown as Record<string, unknown>;
          return (
            <DropdownMenu dir="rtl">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="w-8 h-8">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {rowActions.map((action, idx) => (
                  <DropdownMenuItem
                    key={idx}
                    onClick={() => action.onClick(rowData)}
                    className={action.variant === 'destructive' ? 'text-destructive focus:text-destructive' : ''}
                  >
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ];
    return result as ColumnDef<TData, TValue>[];
  }, [columns, rowActions]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: (updater) => {
      const newSorting = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(newSorting);
      onSortingChange?.(newSorting);
    },
    state: {
      sorting,
    },
    manualPagination: !!onPageChange,
    pageCount: pageCount ?? Math.ceil(data.length / pageSize),
    initialState: {
      pagination: {
        pageSize,
        pageIndex: currentPage - 1,
      },
    },
  });

  if (isLoading) {
    return (
      <div className={cn('glass rounded-2xl p-6', className)}>
        <TableSkeleton rows={5} cols={columns.length} />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={cn('glass rounded-2xl p-6', className)}>
        <TableEmpty message={emptyMessage} action={emptyAction} />
      </div>
    );
  }

  const totalPages = pageCount ?? table.getPageCount();
  const pageIndex = onPageChange ? currentPage - 1 : table.getState().pagination.pageIndex;

  return (
    <div className={cn('glass rounded-2xl overflow-hidden', className)}>
      <div className="overflow-x-auto custom-scrollbar">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      header.column.getCanSort() && 'cursor-pointer select-none hover:bg-accent/50',
                      'text-right'
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="flex flex-col">
                          <ChevronUp
                            className={cn(
                              'w-3 h-3',
                              header.column.getIsSorted() === 'asc' ? 'text-foreground' : 'text-muted-foreground/40'
                            )}
                          />
                          <ChevronDown
                            className={cn(
                              'w-3 h-3 -mt-1',
                              header.column.getIsSorted() === 'desc' ? 'text-foreground' : 'text-muted-foreground/40'
                            )}
                          />
                        </span>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(
                  'hover:bg-accent/30 transition-colors',
                  onRowClick && 'cursor-pointer'
                )}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="text-right">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-sm text-muted-foreground">
            صفحة {pageIndex + 1} من {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="w-8 h-8"
              disabled={pageIndex === 0}
              onClick={() => {
                if (onPageChange) onPageChange(1);
                else table.setPageIndex(0);
              }}
            >
              <ChevronsRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="w-8 h-8"
              disabled={pageIndex === 0}
              onClick={() => {
                if (onPageChange) onPageChange(currentPage - 1);
                else table.previousPage();
              }}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="w-8 h-8"
              disabled={pageIndex >= totalPages - 1}
              onClick={() => {
                if (onPageChange) onPageChange(currentPage + 1);
                else table.nextPage();
              }}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="w-8 h-8"
              disabled={pageIndex >= totalPages - 1}
              onClick={() => {
                if (onPageChange) onPageChange(totalPages);
                else table.setPageIndex(totalPages - 1);
              }}
            >
              <ChevronsLeft className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
