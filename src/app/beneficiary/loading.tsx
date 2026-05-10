import { CardSkeleton, ListSkeleton } from '@/components/common/loading-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function BeneficiaryLoading() {
  return (
    <div className="space-y-6" dir="rtl">
      {/* Welcome Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>

      {/* Services */}
      <ListSkeleton items={3} />

      {/* Active Orders */}
      <CardSkeleton />
    </div>
  );
}
