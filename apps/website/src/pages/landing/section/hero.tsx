"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { SITE_CONFIG } from "@/constants/site";
import CosmicWeb from "../components/cosmic-web";

function Content() {
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
    <div className="z-10 grid min-h-[80vh] w-[90vw] grid-rows-[auto_1fr_auto] gap-4 px-6 sm:mt-[104px] sm:min-h-[85vh] sm:w-[76vw] sm:p-6">
      <div className="col-span-2" />
      <div className="col-span-2 flex w-full flex-col-reverse items-center justify-between lg:flex-row lg:items-start">
        <div className="self-end lg:max-w-[60%]">
          <div className="text-center text-sm lg:text-left 2xl:text-[1vw] 2xl:leading-[1.5vw]">
            <motion.div
              variants={textVariants}
              initial="hidden"
              animate="visible"
              transition={{
                duration: 0.6,
                ease: [0.4, 0, 0.2, 1],
                delay: 0.4,
              }}
              className="flex items-center justify-center lg:justify-start"
            >
              <span className="text-muted-foreground/70 text-sm 2xl:text-[1vw] 2xl:leading-[1vw]">
                <strong className="mr-4 text-3xl text-white">Snapflow</strong>
                <span className="text-lg text-muted-foreground/90">
                  Smart AI Sandboxes
                </span>
              </span>
            </motion.div>
            <motion.p
              variants={textVariants}
              initial="hidden"
              animate="visible"
              transition={{
                duration: 0.6,
                ease: [0.4, 0, 0.2, 1],
                delay: 0.8,
              }}
              className="mt-4 text-muted-foreground/90 text-sm 2xl:text-[1vw] 2xl:leading-[1.5vw]"
            >
              {SITE_CONFIG.DESCIPTION}
            </motion.p>
          </div>
          <div className="mt-4 flex justify-center space-x-2 lg:justify-start ">
            <Button size={"lg"}>Get Started</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <div className="relative flex h-full min-h-screen flex-col items-center justify-start sm:mt-0">
      <div className="webgl -top-[26vh] sm:-top-16 h-full w-full">
        <CosmicWeb />
      </div>
      <Content />
    </div>
  );
}
