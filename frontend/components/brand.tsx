import Image from "next/image";
import Link from "next/link";

/** The header lockup: chair mark, "Armchair Judge" and the show chip. Links home. */
export function Brand() {
  return (
    <Link
      href="/"
      className="flex min-h-11 items-center gap-2 rounded-md focus-ring"
    >
      <Image src="/brand/mark-96.png" alt="" width={32} height={32} unoptimized className="rounded-md" />
      {/* Stacked like the logo on phones, so the header keeps room for the avatar and Sign out. */}
      <span className="flex flex-col text-[15px] leading-[1.05] font-bold tracking-tight sm:flex-row sm:gap-1.5 sm:text-base">
        <span>Armchair</span>
        <span className="text-brand-gradient">Judge</span>
      </span>
      <span className="rounded-sm border border-crown/40 px-1.5 py-px text-[10px] font-semibold tracking-[0.12em] text-crown">
        DWTS
      </span>
    </Link>
  );
}
