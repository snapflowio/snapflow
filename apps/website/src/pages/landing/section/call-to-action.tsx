import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Particles } from "@/components/ui/particles";
import { RetroGrid } from "@/components/ui/retro-grid";
import Container from "../components/container";

const COLOR = "#05DF72";

export function CallToAction() {
  const hexToRgba = (hex: string, alpha: number) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `rgba(${Number.parseInt(result[1], 16)}, ${Number.parseInt(result[2], 16)}, ${Number.parseInt(result[3], 16)}, ${alpha})`
      : `rgba(0, 119, 255, ${alpha})`;
  };

  return (
    <div className="relative flex w-full flex-col items-center justify-center py-12 md:py-16 lg:py-24">
      <Container>
        <div className="relative mx-auto flex h-[500px] w-full flex-col items-center justify-center overflow-hidden rounded-3xl border border-foreground/10 bg-black/50 px-4 text-center md:px-0">
          <div
            className="-translate-x-1/2 pointer-events-none absolute bottom-0 left-1/2 h-[300px] w-[200%]"
            style={{
              background: `radial-gradient(ellipse at center bottom, ${COLOR} 0%, ${hexToRgba(COLOR, 0.5)} 20%, ${hexToRgba(COLOR, 0.2)} 40%, transparent 70%)`,
              filter: "blur(80px)",
              opacity: 0.8,
            }}
          />

          <div
            className="-translate-x-1/2 pointer-events-none absolute bottom-0 left-1/2 h-[200px] w-[150%]"
            style={{
              background: `radial-gradient(circle at center bottom, ${COLOR} 0%, transparent 50%)`,
              filter: "blur(100px)",
              opacity: 0.6,
            }}
          />

          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `
                radial-gradient(circle at top left, ${hexToRgba(COLOR, 0.1)} 0%, transparent 30%),
                radial-gradient(circle at top right, ${hexToRgba(COLOR, 0.1)} 0%, transparent 30%),
                radial-gradient(circle at bottom center, ${hexToRgba(COLOR, 0.2)} 0%, transparent 50%)
              `,
            }}
          />

          <div className="z-20 flex w-full flex-col items-center justify-center">
            <h2
              className="heading !leading-tight mt-6 font-heading font-semibold text-4xl md:text-6xl"
              style={{
                textShadow: `0 0 80px ${hexToRgba(COLOR, 0.6)}, 0 0 40px ${hexToRgba(COLOR, 0.4)}`,
              }}
            >
              Spin up your own <br className="hidden md:block" /> sandboxes now
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-center text-accent-foreground/80 text-base md:text-lg">
              Ready to get started? Create your own sandboxes, for free. No credit card required.
            </p>
            <div className="mt-6 flex w-full flex-col items-center justify-center gap-6 md:flex-row">
              <Button
                asChild
                size="lg"
                className="w-full transition-all duration-500 md:w-max"
                style={{
                  boxShadow: `0 0 30px ${hexToRgba(COLOR, 0.3)}, 0 4px 20px ${hexToRgba(COLOR, 0.2)}`,
                }}
              >
                <Link to="">Get Started</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full border-white/20 transition-all md:w-max"
                style={{
                  borderColor: hexToRgba(COLOR, 0.3),
                  boxShadow: `0 0 20px ${hexToRgba(COLOR, 0.1)}`,
                }}
              >
                <Link to="">Learn More</Link>
              </Button>
            </div>
          </div>
          <Particles
            refresh
            ease={80}
            color={COLOR}
            quantity={40}
            className="pointer-events-none absolute inset-0 size-full opacity-40"
          />
          <RetroGrid className="opacity-20" />
          <Particles
            refresh={false}
            ease={80}
            color="#d4d4d8"
            quantity={80}
            className="pointer-events-none absolute inset-0 size-full opacity-30"
          />
        </div>
      </Container>
    </div>
  );
}
