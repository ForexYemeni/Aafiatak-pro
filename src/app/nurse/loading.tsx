import { CardSkeleton, ListSkeleton } from '@/components/common/loading-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function NurseLoading() {
  return (
    <div className="space-y-6" dir="rtl">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>

      {/* Assignments List */}
      <ListSkeleton items={4} />

      {/* Verification Status */}
      <CardSkeleton />
    </div>
  );
}
