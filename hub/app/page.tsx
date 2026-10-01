import { About } from "@/components/about";
import { CatalogStrip } from "@/components/catalog-strip";
import { Faq } from "@/components/faq";
import { Features } from "@/components/features";
import { FinalCta } from "@/components/final-cta";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { Intro } from "@/components/intro";
import { OneAccount } from "@/components/one-account";
import { ScrollReveals } from "@/components/scroll-reveals";
import { SectionRail } from "@/components/section-rail";
import { ShowNight } from "@/components/show-night";
import { Shows } from "@/components/shows";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <>
      <Intro />
      <ScrollReveals />
      <div id="page">
        <SiteHeader />
        <SectionRail />
        <main id="main" tabIndex={-1} className="outline-none">
          <Hero />
          <CatalogStrip />
          <HowItWorks />
          <Features />
          <ShowNight />
          <OneAccount />
          <Shows />
          <Faq />
          <About />
          <FinalCta />
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
