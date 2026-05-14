import { ListSkeleton, ProfileSkeleton } from '@/components/common/loading-skeleton';

export default function Loading() {
  return (
    <div className="space-y-4">
      <ListSkeleton items={6} />
    </div>
  );
}
