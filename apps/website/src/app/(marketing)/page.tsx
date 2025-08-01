import { Wrapper } from "@/components/wrapper";
import { MaxWidthWrapper } from "@/components/wrappers/max-width-wrapper";
import { CallToAction } from "./_components/call-to-action";
import Features from "./_components/features";
import { Hero } from "./_components/hero";

export default function HomePage() {
  return (
    <MaxWidthWrapper className="relative">
      <Hero />
      <div className="relative z-30 bg-background">
        <Wrapper className="relative mb-30 space-y-42">
          <Features />
          <CallToAction />
        </Wrapper>
      </div>
    </MaxWidthWrapper>
  );
}
