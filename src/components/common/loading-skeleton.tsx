'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ============================================================================
// Card Skeleton
// ============================================================================

interface CardSkeletonProps {
  className?: string;
}

export function CardSkeleton({ className }: CardSkeletonProps) {
  return (
    <div className={cn('glass rounded-2xl p-6 space-y-4', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-12 w-12 rounded-xl" />
      </div>
      <Skeleton className="h-4 w-40" />
    </div>
  );
}

// ============================================================================
// Table Skeleton
// ============================================================================

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function TableSkeleton({ rows = 5, cols = 4, className }: TableSkeletonProps) {
  return (
    <div className={cn('glass rounded-2xl p-6', className)}>
      {/* Header */}
      <div className="flex gap-4 mb-4 pb-4 border-b border-border">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-3">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-5 flex-1" />
          ))}
        </div>
      ))}
      {/* Pagination */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-8" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// List Skeleton
// ============================================================================

interface ListSkeletonProps {
  items?: number;
  className?: string;
}

export function ListSkeleton({ items = 5, className }: ListSkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="glass rounded-xl p-4 flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Chart Skeleton
// ============================================================================

interface ChartSkeletonProps {
  className?: string;
}

export function ChartSkeleton({ className }: ChartSkeletonProps) {
  return (
    <div className={cn('glass rounded-2xl p-6', className)}>
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="flex items-end gap-2 h-48">
        {[60, 80, 45, 90, 55, 75, 40].map((h, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-md"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-8" />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Profile Skeleton
// ============================================================================

interface ProfileSkeletonProps {
  className?: string;
}

export function ProfileSkeleton({ className }: ProfileSkeletonProps) {
  return (
    <div className={cn('glass rounded-2xl p-6', className)}>
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
