/** Placeholder until the hooded-figure loader lands; that work replaces this file. */
export function Loader({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-[50dvh] w-full flex-1 items-center justify-center py-12">
      <span className="font-display tracking-[0.18em] text-ash uppercase">{label}...</span>
    </div>
  );
}
