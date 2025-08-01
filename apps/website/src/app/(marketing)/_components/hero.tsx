import { ArrowRight, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Particles } from "@/components/ui/particles";
import { AnnouncementBanner } from "@/components/wrappers/annoucement-banner";
import { Path } from "@/constants/paths";
import { SITE_CONFIG } from "@/constants/site";
import { AnimatedCube } from "./animated-cube";

export function Hero() {
  return (
    <section className="relative min-h-screen px-6">
      <Particles
        refresh={false}
        ease={80}
        color="#d4d4d8"
        quantity={500}
        className="pointer-events-none absolute inset-0 size-full opacity-40"
      />
      <div className="container relative mx-auto max-w-6xl">
        <div className="grid min-h-[80vh] items-start lg:grid-cols-2">
          <div className="flex h-full flex-col justify-center space-y-4 text-left">
            <AnnouncementBanner
              text="Snapflow.io v1 beta is here!"
              href="/"
              logo={<Logo size={24} asLink={false} />}
            />
            <h1 className="bg-gradient-to-b from-gray-100 to-gray-300 bg-clip-text font-black text-7xl text-transparent leading-tight">
              Powerful & scalable sandboxes
            </h1>
            <p className="mb-5 max-w-lg text-gray-300 text-lg leading-relaxed">
              {SITE_CONFIG.DESCIPTION}
            </p>
            <div className="mt-2 flex flex-wrap gap-4">
              <Button size="lg" className="bg-primary text-background" asChild>
                <Link href={Path.DASHBOARD}>
                  Get Started for Free
                  <ChevronRightIcon />
                </Link>
              </Button>
              <Button variant="ghost" size="lg">
                Our Blog
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex h-full flex-col justify-end">
            <div className="flex justify-center">
              <div className="-translate-y-14 lg:translate-x-28">
                <AnimatedCube />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
