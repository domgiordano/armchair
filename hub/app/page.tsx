import { About } from "@/components/about";
import { HomeSwitch } from "@/components/account/home-switch";
import { ChairLoader } from "@/components/chair-loader";
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
      {/* Shown by CSS only while <html data-account> is set (app/account.css). */}
      <div className="account-boot" aria-hidden="true">
        <ChairLoader className="size-24" />
      </div>
      <HomeSwitch>
        <Landing />
      </HomeSwitch>
    </>
  );
}

function Landing() {
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
