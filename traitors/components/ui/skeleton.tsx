import { cn } from "@/lib/ui";

/** A shimmering block the size of what's coming. Decorative; pair it with a spoken status. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("block skeleton rounded-sm", className)} />;
}

interface SkeletonListProps {
  /** What's loading, for screen readers: "Loading the episodes". */
  label: string;
  rows?: number;
  /** Row height class. */
  row?: string;
}

export function SkeletonList({ label, rows = 4, row = "h-14" }: SkeletonListProps) {
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">{label}...</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={row} />
      ))}
    </div>
  );
}
