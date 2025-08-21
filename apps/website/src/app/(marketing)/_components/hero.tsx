import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Particles } from "@/components/ui/particles";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { Path } from "@/constants/paths";
import { SITE_CONFIG } from "@/constants/site";
import { AnimatedText } from "../../../components/ui/animated-text";
import { AnimatedCube } from "./graphics/animated-cube";

export function Hero() {
  return (
    <div className="-mt-16 relative flex h-screen w-full flex-col items-center justify-center">
      <Particles
        refresh={false}
        ease={80}
        color="#fff"
        quantity={200}
        className="pointer-events-none absolute inset-0 size-full opacity-60"
      />

      <div className="container relative z-20 flex max-w-6xl flex-col items-center justify-center text-center">
        <AnimatedCube />
        <div className="flex w-full flex-col items-center justify-center space-y-4 text-center">
          <h1 className="bg-gradient-to-b from-gray-100 to-gray-300 bg-clip-text font-black text-5xl text-transparent leading-tight tracking-tighter md:text-7xl">
            AI sandboxes for <br />
            <AnimatedText
              phrases={[
                "AI agents",
                "automations",
                "workflows",
                "coding agents",
                "background jobs",
              ]}
            />
          </h1>
          <p className="mx-auto mb-5 max-w-md text-gray-300 text-lg leading-relaxed">
            {SITE_CONFIG.DESCIPTION}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-4">
            <RainbowButton size={"lg"}>Signup for free</RainbowButton>
            <Button size={"lg"} variant="ghost" asChild>
              <Link href={Path.BLOG}>
                Our Blog
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
