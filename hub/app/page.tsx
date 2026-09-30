import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { Intro } from "@/components/intro";
import { SectionRail } from "@/components/section-rail";
import { Shows } from "@/components/shows";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <>
      <Intro />
      <div id="page">
        <SiteHeader />
        <SectionRail />
        <main id="main" tabIndex={-1} className="outline-none">
          <Hero />
          <HowItWorks />
          <Shows />
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
