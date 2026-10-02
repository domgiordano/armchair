import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { HUB_URL, TRAITORS_URL } from "@/components/apps-menu";
import { ICON_TRIGGER, ShowIcon, type Show } from "@/components/show-icon";
import { FOCUS } from "@/lib/ui";

// Kept in step with hub/components/site-footer.tsx by hand: the two apps share no package.

const GITHUB_URL = "https://github.com/domgiordano/armchair";
const XOMWARE_URL = "https://xomware.com";

const LINK = `group/link relative inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-silver-dim transition-colors hover:text-pearl motion-reduce:transition-none ${FOCUS}`;

// The underline grows from the left on hover and focus.
const UNDERLINE =
  "pointer-events-none absolute inset-x-0 bottom-2.5 h-px origin-left scale-x-0 bg-gold transition-transform duration-300 group-hover/link:scale-x-100 group-focus-visible/link:scale-x-100 motion-reduce:transition-none";

// Stamped when the static page is built.
const YEAR = new Date().getFullYear();

interface App {
  show: Show;
  name: string;
  href?: string;
}

const APPS: App[] = [
  { show: "dwts", name: "Dancing with the Stars", href: "/" },
  { show: "traitors", name: "The Traitors", href: TRAITORS_URL },
  { show: "survivor", name: "Survivor" },
];

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  const body = (
    <>
      {children}
      <span aria-hidden="true" className={UNDERLINE} />
    </>
  );
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={LINK}>
        {body}
      </Link>
    );
  }
  return (
    <a href={href} className={LINK}>
      {body}
    </a>
  );
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav aria-label={title}>
      <h2 className="text-[11px] font-semibold tracking-[0.25em] text-pearl uppercase">{title}</h2>
      <ul className="mt-3 flex flex-col">{children}</ul>
    </nav>
  );
}

function AppItem({ app }: { app: App }) {
  const icon = <ShowIcon show={app.show} size={28} locked={!app.href} />;
  if (!app.href) {
    return (
      <li className={`${ICON_TRIGGER} flex min-h-11 items-center gap-2.5 text-sm text-silver-dim/70`}>
        {icon}
        <span>{app.name}</span>
        <span className="rounded-full border border-silver/20 px-2 py-0.5 text-[9px] font-bold tracking-[0.15em] whitespace-nowrap">
          SOON
        </span>
      </li>
    );
  }
  return (
    <li>
      <AppLink href={app.href}>
        {icon}
        <span className="relative">
          {app.name}
          <span aria-hidden="true" className={`${UNDERLINE} bottom-0`} />
        </span>
        <span className="flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[9px] font-bold tracking-[0.15em] text-gold-light">
          <span className="size-1 rounded-full bg-current motion-safe:animate-pulse" aria-hidden="true" />
          LIVE
        </span>
      </AppLink>
    </li>
  );
}

function AppLink({ href, children }: { href: string; children: ReactNode }) {
  const className = `${LINK} ${ICON_TRIGGER} gap-2.5`;
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-silver/10 bg-ballroom/30">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-gold/60 to-transparent"
      />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-14 pb-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] lg:gap-16">
        <div className="flex flex-col items-start gap-4">
          <a href={HUB_URL} className={`group flex min-h-11 items-center gap-3 rounded-md ${FOCUS}`}>
            <Image
              src="/brand/mark-96.png"
              alt=""
              width={40}
              height={40}
              unoptimized
              className="rounded-md transition-transform duration-300 group-hover:-rotate-6 motion-reduce:transition-none"
            />
            <span className="font-bold tracking-tight text-pearl">
              Armchair <span className="text-brand-gradient">Judge</span>
            </span>
          </a>
          <p className="max-w-xs text-sm leading-relaxed text-silver-dim">
            Score the show from your couch, then see how the real panel and everyone else scored it.
          </p>
          <a
            href={XOMWARE_URL}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-silver/20 px-4 text-xs font-semibold tracking-wide text-silver-dim transition-colors hover:border-gold hover:text-gold-light motion-reduce:transition-none ${FOCUS}`}
          >
            A Xomware app
            <ArrowIcon />
          </a>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-[minmax(0,1.7fr)_repeat(3,minmax(0,1fr))]">
          <div className="col-span-2 sm:col-span-1">
            <Column title="Apps">
              {APPS.map((app) => (
                <AppItem key={app.show} app={app} />
              ))}
              <li>
                <FooterLink href={HUB_URL}>armchairjudge.com</FooterLink>
              </li>
            </Column>
          </div>
          <Column title="Product">
            <li>
              <FooterLink href="/#how">How it works</FooterLink>
            </li>
            <li>
              <FooterLink href={`${HUB_URL}/#faq`}>FAQ</FooterLink>
            </li>
            <li>
              <FooterLink href="/discover/">Discover</FooterLink>
            </li>
          </Column>
          <Column title="Legal">
            <li>
              <FooterLink href={`${HUB_URL}/privacy/`}>Privacy</FooterLink>
            </li>
            <li>
              <FooterLink href={`${HUB_URL}/terms/`}>Terms</FooterLink>
            </li>
            <li>
              <FooterLink href="/credits/">Photo credits</FooterLink>
            </li>
          </Column>
          <Column title="Open source">
            <li>
              <FooterLink href={GITHUB_URL}>
                <GitHubIcon />
                GitHub
              </FooterLink>
            </li>
          </Column>
        </div>
      </div>

      <div className="border-t border-silver/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs leading-relaxed text-silver-dim sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
          <p className="shrink-0">&copy; {YEAR} Armchair Judge &middot; An independent fan project</p>
          <p className="sm:text-right">Not affiliated with ABC, Disney, BBC, BBC Studios, NBC, Peacock or The Traitors.</p>
        </div>
      </div>
    </footer>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
      <path d="M5 11 11 5M6 5h5v5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
