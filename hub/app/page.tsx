import Image from "next/image";

import { Intro } from "@/components/intro";

export default function HomePage() {
  return (
    <>
      <Intro />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-6 px-6 text-center outline-none"
      >
        <Image src="/mark.png" alt="" width={160} height={160} priority className="rounded-3xl" />
        <h1 className="text-5xl leading-tight font-extrabold tracking-tight">
          Armchair <span className="text-brand-gradient">Judge</span>
        </h1>
        <p className="text-sm font-medium tracking-[0.35em] text-muted">DISCOVER / WATCH / JUDGE</p>
        <a
          href="https://dwts.xomware.com"
          className="inline-flex min-h-11 items-center rounded-full bg-text px-6 font-semibold text-night hover:bg-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
        >
          Judge Dancing with the Stars
        </a>
      </main>
    </>
  );
}
