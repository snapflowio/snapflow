"use client";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Particles } from "@/components/ui/particles";
import { SITE_CONFIG } from "@/constants/site";
import { Path } from "@/enums/paths";
import { AnimatedCube } from "../components/animated-cube";

export function Hero() {
  const textVariants = {
    hidden: {
      opacity: 0,
      filter: "blur(20px)",
    },
    visible: {
      opacity: 1,
      filter: "blur(0px)",
    },
  };

  return (
    <section className="relative min-h-screen bg-black px-6 pt-25">
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
            <motion.div
              variants={textVariants}
              initial="hidden"
              animate="visible"
              transition={{
                duration: 0.6,
                ease: [0.4, 0, 0.2, 1],
                delay: 0.4,
              }}
            >
              <h1 className="mb-8 font-medium text-7xl text-white leading-tight">
                Powerful and scalable
                <br />
                <span className="text-green-400">sandboxes</span>
              </h1>
            </motion.div>
            <motion.div
              variants={textVariants}
              initial="hidden"
              animate="visible"
              transition={{
                duration: 0.6,
                ease: [0.4, 0, 0.2, 1],
                delay: 0.8,
              }}
              className="mb-8 flex flex-wrap gap-4"
            >
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
            </motion.div>
          </div>
          <div className="text-left lg:text-right">
            <motion.p
              variants={textVariants}
              initial="hidden"
              animate="visible"
              transition={{
                duration: 0.6,
                ease: [0.4, 0, 0.2, 1],
                delay: 1.2,
              }}
              className="max-w-lg text-gray-300 text-lg leading-relaxed lg:ml-auto"
            >
              {SITE_CONFIG.DESCIPTION}
            </motion.p>
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
