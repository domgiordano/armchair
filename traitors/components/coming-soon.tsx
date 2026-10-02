import { EmptyState } from "@/components/ui/states";

/** A tab whose screen hasn't landed yet. */
export function ComingSoon({ what }: { what: string }) {
  return <EmptyState title={what}>The castle is still lighting this room. Check back soon.</EmptyState>;
}
