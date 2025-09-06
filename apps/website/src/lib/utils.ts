import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import { Path } from "@/enums/paths";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(...inputs));
}

export function isRouteActive(routeUrl: Path | string, currentPathname: string): boolean {
  if (routeUrl === "#") {
    return false;
  }

  if (routeUrl === Path.DASHBOARD) {
    return currentPathname === routeUrl;
  }

  return currentPathname.startsWith(routeUrl);
}

export function getRelativeTimeString(
  timestamp: string | Date | null | undefined,
  fallback = "-"
): { date: Date; relativeTimeString: string } {
  if (!timestamp) {
    return { date: new Date(), relativeTimeString: fallback };
  }

  let date: Date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return { date: new Date(), relativeTimeString: fallback };
    }
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const isFuture = diffMs < 0;
  const absDiffMs = Math.abs(diffMs);

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const year = 365 * day;

  let relativeTimeString: string;

  if (absDiffMs < minute) {
    relativeTimeString = isFuture ? "shortly" : "just now";
  } else if (absDiffMs < hour) {
    const m = Math.floor(absDiffMs / minute);
    relativeTimeString = isFuture ? `in ${m}m` : `${m}m ago`;
  } else if (absDiffMs < day) {
    const h = Math.floor(absDiffMs / hour);
    relativeTimeString = isFuture ? `in ${h}h` : `${h}h ago`;
  } else if (absDiffMs < year) {
    const d = Math.floor(absDiffMs / day);
    relativeTimeString = isFuture ? `in ${d}d` : `${d}d ago`;
  } else {
    const y = Math.floor(absDiffMs / year);
    relativeTimeString = isFuture ? `in ${y}y` : `${y}y ago`;
  }

  return { date, relativeTimeString };
}

export function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  return value[0].toUpperCase() + value.slice(1);
}
