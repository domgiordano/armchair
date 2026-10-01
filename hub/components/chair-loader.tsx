import { ChairMark } from "@/components/chair-mark";

interface ChairLoaderProps {
  className?: string;
  /** Announced and shown under the mark. Without one the loader is decorative. */
  label?: string;
}

/** The armchair mark with the crown bobbing and the "10" paddle flipping. */
export function ChairLoader({ className = "", label }: ChairLoaderProps) {
  const mark = <ChairMark className={`chair-loader ${className}`} />;
  if (!label) return mark;
  return (
    <div role="status" className="flex flex-col items-center gap-4">
      {mark}
      <span className="text-sm font-medium tracking-[0.2em] text-muted uppercase">{label}</span>
    </div>
  );
}
