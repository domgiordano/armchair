import { cn } from "@/lib/ui";

interface SkeletonProps {
  className?: string;
}

/** A shimmering block the size of what's coming. Decorative; pair it with a spoken status. */
export function Skeleton({ className }: SkeletonProps) {
  return <span aria-hidden="true" className={cn("block skeleton rounded-md", className)} />;
}

interface SkeletonListProps {
  /** What's loading, for screen readers: "Loading your friends". */
  label: string;
  rows?: number;
  /** Row height class. */
  row?: string;
  avatar?: boolean;
}

/** Stacked placeholder rows with a status for screen readers. */
export function SkeletonList({ label, rows = 4, row = "h-12", avatar = false }: SkeletonListProps) {
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">{label}...</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          {avatar && <Skeleton className="size-9 shrink-0 rounded-full" />}
          <Skeleton className={cn("flex-1 rounded-lg", row)} />
        </div>
      ))}
    </div>
  );
}
