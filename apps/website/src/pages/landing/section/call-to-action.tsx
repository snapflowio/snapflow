import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Particles } from "@/components/ui/particles";
import { RetroGrid } from "@/components/ui/retro-grid";
import Container from "../components/container";

export function CallToAction() {
  return (
    <div className="relative flex w-full flex-col items-center justify-center py-12 md:py-16 lg:py-24">
      <Container>
        <div className="relative mx-auto flex h-[500px] w-full flex-col items-center justify-center overflow-hidden rounded-3xl border border-foreground/10 px-4 text-center md:px-0">
          <div className="-translate-x-1/2 absolute bottom-0 left-1/2 h-12 w-full bg-violet-500 blur-[10rem]" />
          <div className="z-20 flex w-full flex-col items-center justify-center">
            <h2 className="heading !leading-tight mt-6 font-heading font-semibold text-4xl md:text-6xl">
              Create your own <br className="hidden md:block" /> AI agents now
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-center text-accent-foreground/80 text-base md:text-lg">
              Ready to get started? Sign up now and start becoming 10x more
              productive.
            </p>
            <div className="mt-6 flex w-full flex-col items-center justify-center gap-6 md:flex-row">
              <Button asChild size="lg" className="w-full md:w-max">
                <Link to="">Get Started</Link>
              </Button>
              <Button asChild size="lg" className="w-full md:w-max">
                <Link to="">Learn More</Link>
              </Button>
            </div>
          </div>
          <RetroGrid />
          <Particles
            refresh
            ease={80}
            color="#d4d4d8"
            quantity={100}
            className="absolute inset-0 size-full"
          />
        </div>
      </Container>
    </div>
  );
}
