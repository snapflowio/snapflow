"use client";

import React, { ComponentPropsWithoutRef, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/util";

export function AnimatedListItem({ children }: { children: React.ReactNode }) {
  const initial = { scale: 0, opacity: 0 };
  const animate = { scale: 1, opacity: 1, originY: 0 };
  const exit = { scale: 0, opacity: 0 };
  const transition = { type: "spring" as const, stiffness: 350, damping: 40 };

  return (
    <motion.div
      initial={initial}
      animate={animate}
      exit={exit}
      transition={transition}
      layout
      className="mx-auto w-full"
    >
      {children}
    </motion.div>
  );
}

export interface AnimatedListProps extends ComponentPropsWithoutRef<"div"> {
  children: React.ReactNode;
  delay?: number;
}

export const AnimatedList = React.memo(
  ({ children, className, delay = 1000, ...props }: AnimatedListProps) => {
    const [index, setIndex] = useState(0);
    const childrenArray = useMemo(() => React.Children.toArray(children), [children]);

    useEffect(() => {
      if (index < childrenArray.length - 1) {
        const timeout = setTimeout(() => {
          setIndex((prevIndex) => (prevIndex + 1) % childrenArray.length);
        }, delay);

        return () => clearTimeout(timeout);
      }
    }, [index, delay, childrenArray.length]);

    const itemsToShow = useMemo(() => {
      const result = childrenArray.slice(0, index + 1).reverse();
      return result;
    }, [index, childrenArray]);

    return (
      <div className={cn(`flex flex-col items-center gap-4`, className)} {...props}>
        <AnimatePresence>
          {itemsToShow.map((item) => (
            <AnimatedListItem key={(item as React.ReactElement).key}>{item}</AnimatedListItem>
          ))}
        </AnimatePresence>
      </div>
    );
  }
);

AnimatedList.displayName = "AnimatedList";
