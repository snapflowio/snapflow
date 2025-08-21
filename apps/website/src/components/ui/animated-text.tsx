"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/util";

interface AnimatedTextProps {
  phrases: string[];
  className?: string;
  interval?: number;
}

export function AnimatedText({ phrases, className, interval = 3000 }: AnimatedTextProps) {
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [phraseWidths, setPhraseWidths] = useState<number[]>([]);
  const [isReady, setIsReady] = useState(false);
  const measureRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // Pre-measure all phrase widths
  useLayoutEffect(() => {
    const widths: number[] = [];
    measureRefs.current.forEach((ref, index) => {
      if (ref) {
        const width = ref.getBoundingClientRect().width;
        widths[index] = width;
      }
    });

    if (widths.length === phrases.length && widths.every((w) => w > 0)) {
      setPhraseWidths(widths);
      setIsReady(true);
    }
  }, [phrases]);

  useEffect(() => {
    if (!isReady) return;

    const timer = setInterval(() => {
      setCurrentPhraseIndex((prevIndex) => (prevIndex + 1) % phrases.length);
    }, interval);

    return () => clearInterval(timer);
  }, [phrases.length, interval, isReady]);

  const currentPhrase = phrases[currentPhraseIndex];
  const currentWidth = phraseWidths[currentPhraseIndex];

  if (!isReady) {
    return (
      <div className="relative inline-flex">
        {phrases.map((phrase, index) => (
          <span
            key={index}
            ref={(el) => {
              measureRefs.current[index] = el;
            }}
            className="pointer-events-none absolute whitespace-nowrap px-3 py-1 opacity-0"
            style={{
              fontFamily: "inherit",
              fontSize: "inherit",
              fontWeight: "inherit",
              top: `${index * -100}px`,
            }}
          >
            {phrase}
          </span>
        ))}
        <span className={cn("inline-flex rounded-md bg-white px-3 py-1 text-black", className)}>
          {phrases[0]}
        </span>
      </div>
    );
  }

  return (
    <div className="relative inline-flex">
      <motion.span
        className={cn(
          "inline-flex items-center justify-start overflow-hidden rounded-md bg-white px-3 py-1 text-black",
          className
        )}
        animate={{ width: currentWidth }}
        transition={{ duration: 0.5, ease: [0.4, 0.0, 0.2, 1] }}
      >
        <AnimatePresence mode="popLayout">
          <motion.span
            key={currentPhraseIndex}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{
              duration: 0.3,
              ease: "easeInOut",
              layout: { duration: 0.5 },
            }}
            className="whitespace-nowrap"
          >
            {currentPhrase}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </div>
  );
}
