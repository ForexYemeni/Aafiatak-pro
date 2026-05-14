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
    <div className={cn('bg-card border border-border/60 rounded-2xl p-5 space-y-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-20 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-xl" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-12 w-12 rounded-2xl shrink-0" />
      </div>
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
    <div className={cn('bg-card border border-border/60 rounded-2xl p-5', className)}>
      {/* Header */}
      <div className="flex gap-4 mb-4 pb-4 border-b border-border/60">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 flex-1 rounded-full" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-3 border-b border-border/40 last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1 rounded-full" style={{ opacity: 1 - i * 0.08 }} />
          ))}
        </div>
      ))}
      {/* Pagination */}
      <div className="flex items-center justify-between pt-4 mt-2">
        <Skeleton className="h-3.5 w-28 rounded-full" />
        <div className="flex gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-8 rounded-lg" />
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
    <div className={cn('space-y-2.5', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="bg-card border border-border/60 rounded-xl p-4 flex items-center gap-3"
          style={{ opacity: 1 - i * 0.1 }}
        >
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/4 rounded-full" />
            <Skeleton className="h-3 w-1/2 rounded-full" />
          </div>
          <Skeleton className="h-6 w-14 rounded-full" />
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
    <div className={cn('bg-card border border-border/60 rounded-2xl p-5', className)}>
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-4 w-32 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-lg" />
      </div>
      <div className="flex items-end gap-2 h-44">
        {[55, 75, 40, 90, 60, 80, 45].map((h, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-lg"
            style={{ height: `${h}%`, opacity: 0.6 + i * 0.04 }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 w-6 rounded-full" />
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
    <div className={cn('bg-card border border-border/60 rounded-2xl p-5', className)}>
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="h-16 w-16 rounded-full shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4.5 w-40 rounded-full" />
          <Skeleton className="h-3.5 w-24 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <div className="space-y-3.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3.5 w-20 rounded-full shrink-0" />
            <Skeleton className="h-3.5 flex-1 rounded-full" style={{ opacity: 0.8 - i * 0.1 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Stat Cards Skeleton Row
// ============================================================================

interface StatCardsSkeletonProps {
  count?: number;
  className?: string;
}

export function StatCardsSkeleton({ count = 4, className }: StatCardsSkeletonProps) {
  return (
    <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
