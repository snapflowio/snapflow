import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Particles } from "@/components/ui/particles";
import { SITE_CONFIG } from "@/constants/site";
import { Path } from "@/enums/paths";
import { AnimatedCube } from "../components/animated-cube";

export function Hero() {
  return (
    <section className="relative min-h-screen px-6 pt-25">
      <Particles
        refresh={false}
        ease={80}
        color="#d4d4d8"
        quantity={500}
        className="pointer-events-none absolute inset-0 size-full opacity-40"
      />
      <div className="container relative mx-auto max-w-6xl">
        <div className="mt-20 grid min-h-[80vh] items-start gap-12 lg:grid-cols-2">
          <div className="text-left">
            <h1 className="mb-8 font-bold text-7xl text-white leading-tight">
              Powerful & scalable
              <br />
              <span className="text-primary">sandboxes</span>
            </h1>
            <div className="mb-8 flex flex-wrap gap-4">
              <Button size="lg" className="bg-primary text-background">
                Get Started
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to={Path.PRICING}>Pricing</Link>
              </Button>
              <Button variant="ghost" size="lg">
                Visit our blog
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="text-left lg:text-right">
            <p className="max-w-lg text-gray-300 text-lg leading-relaxed lg:ml-auto">
              {SITE_CONFIG.DESCIPTION}
            </p>
            <div className="mt-16 flex justify-center">
              <div className="lg:translate-x-14">
                <AnimatedCube />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
