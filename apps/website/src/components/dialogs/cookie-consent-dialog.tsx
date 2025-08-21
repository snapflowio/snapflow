"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const COOKIE_CONSENT_KEY = "cookie-consent";

export function CookieConsentDialog() {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldMount, setShouldMount] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      setShouldMount(true);
      setTimeout(() => setIsVisible(true), 100);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setIsVisible(false);
    setTimeout(() => setShouldMount(false), 300);
  };

  const handleDecline = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "declined");
    setIsVisible(false);
    setTimeout(() => setShouldMount(false), 300);
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => setShouldMount(false), 300);
  };

  if (!shouldMount) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{
            opacity: 0,
            scale: 0.8,
            y: 20,
            filter: "blur(4px)",
          }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
            filter: "blur(0px)",
          }}
          exit={{
            opacity: 0,
            scale: 0.9,
            y: 10,
            filter: "blur(2px)",
          }}
          transition={{
            type: "spring",
            duration: 0.6,
            bounce: 0.1,
            ease: [0.23, 1, 0.32, 1],
          }}
          className="fixed right-4 bottom-4 z-50 max-w-[400px] rounded-md border bg-background p-4 shadow-lg"
        >
          <div className="flex gap-2">
            <div className="flex grow flex-col gap-3">
              <div className="space-y-1">
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="font-medium text-sm"
                >
                  We Value Your Privacy 🍪
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.4 }}
                  className="text-muted-foreground text-sm"
                >
                  We use cookies for esssential functionality and to improve your experience.
                </motion.p>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="flex gap-2"
              >
                <Button size="sm" onClick={handleAccept}>
                  Accept
                </Button>
                <Button size="sm" variant="outline" onClick={handleDecline}>
                  Decline
                </Button>
              </motion.div>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
            >
              <Button
                variant="ghost"
                className="group -my-1.5 -me-2 size-8 shrink-0 p-0 hover:bg-transparent"
                aria-label="Close notification"
                onClick={handleClose}
              >
                <XIcon
                  size={16}
                  className="opacity-60 transition-opacity group-hover:opacity-100"
                  aria-hidden="true"
                />
              </Button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
