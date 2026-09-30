import { ChairMark } from "@/components/chair-mark";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <ChairMark className="h-10 w-10" />
          <div>
            <p className="font-bold tracking-tight">
              Armchair <span className="text-brand-gradient">Judge</span>
            </p>
            <p className="text-[11px] font-medium tracking-[0.3em] text-muted">DISCOVER / WATCH / JUDGE</p>
          </div>
        </div>
        <p className="max-w-md text-xs leading-relaxed text-muted">
          Not affiliated with ABC, Disney, BBC, Peacock, CBS or the shows&rsquo; producers. Show names are used to describe
          what you can rate.
        </p>
      </div>
    </footer>
  );
}
