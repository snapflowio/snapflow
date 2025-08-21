import Link from "next/link";
import { Particles } from "@/components/ui/particles";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { RetroGrid } from "@/components/ui/retro-grid";
import { Path } from "@/constants/paths";

export function CallToAction() {
  return (
    <div className="relative flex w-full flex-col items-center justify-center">
      <div className="h-full w-full">
        <div className="relative mx-auto flex h-[500px] w-full flex-col items-center justify-center overflow-hidden rounded-3xl border px-4 text-center md:px-0">
          <div className="pointer-events-none absolute inset-0" />

          <div className="z-20 flex w-full flex-col items-center justify-center">
            <h2 className="heading !leading-tight mt-6 font-heading font-semibold text-4xl text-white md:text-6xl">
              Spin up your own <br className="hidden md:block" /> sandboxes now
            </h2>
            <p className="mx-auto mt-6 max-w-md text-center text-base text-zinc-200 md:text-lg">
              Ready to get started? Create your own sandboxes, for free. Get $10 of free credit when
              you sign up.
            </p>
            <div className="mt-6 flex w-full flex-col items-center justify-center gap-6 md:flex-row">
              <RainbowButton
                asChild
                size="lg"
                className="w-full transition-all duration-500 md:w-max"
              >
                <Link href={Path.DASHBOARD}>Get Started</Link>
              </RainbowButton>
            </div>
          </div>
          <RetroGrid />
          <Particles
            refresh
            ease={80}
            color="#fff"
            quantity={100}
            className="pointer-events-none absolute inset-0 size-full opacity-60"
          />
        </div>
      </div>
    </div>
  );
}
