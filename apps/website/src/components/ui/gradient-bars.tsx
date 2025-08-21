"use client";

import { motion } from "motion/react";

interface GradientBarsProps {
  bars?: number;
  colors?: string[];
}

export const GradientBars = ({
  bars = 20,
  colors = ["#e60a64", "transparent"],
}: GradientBarsProps) => {
  const gradientStyle = `linear-gradient(to top, ${colors.join(", ")})`;

  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden"
      style={{
        WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 90%, rgba(0,0,0,0) 100%)",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskSize: "100% 100%",
        maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 90%, rgba(0,0,0,0) 100%)",
        maskRepeat: "no-repeat",
        maskSize: "100% 100%",
      }}
    >
      <div className="flex h-full w-full">
        {Array.from({ length: bars }).map((_, index) => {
          const position = index / (bars - 1);
          const center = 0.5;
          const distance = Math.abs(position - center);
          const scale = 0.3 + 0.7 * (distance * 2) ** 1.2;

          return (
            <motion.div
              key={`bg-bar-${index}`}
              className="flex-1 origin-bottom"
              style={{ background: gradientStyle }}
              animate={{
                scaleY: [scale, scale + 0.1, scale],
                opacity: [1, 0.95, 1],
              }}
              transition={{
                duration: 3,
                ease: "easeInOut",
                repeat: Number.POSITIVE_INFINITY,
                repeatType: "mirror",
                delay: index * 0.5,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
