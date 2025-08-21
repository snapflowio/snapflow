"use client";

import { CookieConsentDialog } from "@/components/dialogs/cookie-consent-dialog";
import { Wrapper } from "@/components/wrapper";
import { MaxWidthWrapper } from "@/components/wrappers/max-width-wrapper";
import { CallToAction } from "./_components/call-to-action";
import FAQ from "./_components/faq";
import { Features } from "./_components/features";
import { Hero } from "./_components/hero";
import LlmIntegrations from "./_components/llms";

export default function HomePage() {
  return (
    <>
      <Hero />
      <MaxWidthWrapper>
        <Wrapper className="relative space-y-56 py-36">
          <Features />
          <LlmIntegrations />
          <CallToAction />
          <FAQ />
        </Wrapper>
      </MaxWidthWrapper>
      <CookieConsentDialog />
    </>
  );
}
