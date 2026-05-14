import { StatCardsSkeleton, TableSkeleton } from '@/components/common/loading-skeleton';

export default function Loading() {
  return (
    <div className="space-y-4">
      <StatCardsSkeleton count={4} />
      <TableSkeleton rows={7} cols={5} />
    </div>
  );
}
