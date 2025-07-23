import { Wrapper } from "@/components/wrapper";
import { CallToAction } from "./section/call-to-action";
import Features from "./section/features";
import { Hero } from "./section/hero";

export default function Landing() {
  return (
    <main className="relative">
      <Hero />
      <div className="relative z-30 bg-background">
        <Wrapper className="relative mb-30 space-y-42">
          <Features />
          <CallToAction />
        </Wrapper>
      </div>
    </main>
  );
}
