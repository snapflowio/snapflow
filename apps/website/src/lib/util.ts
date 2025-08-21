import { type ClassValue, clsx } from "clsx";
import { Metadata } from "next";
import { twMerge } from "tailwind-merge";
import { Path } from "@/constants/paths";
import { SITE_CONFIG } from "@/constants/site";
import { env } from "@/env";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(...inputs));
}

export function isRouteActive(routeUrl: Path | string, currentPathname: string | null): boolean {
  if (routeUrl === "#" || !currentPathname) return false;

  if (routeUrl === Path.DASHBOARD) {
    return currentPathname === routeUrl;
  }

  return currentPathname.startsWith(routeUrl);
}

export function formatDate(input: string | number): string {
  return new Date(input).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function getRelativeTimeString(
  timestamp: string | Date | null | undefined,
  fallback = "-"
): { date: Date; relativeTimeString: string } {
  if (!timestamp) return { date: new Date(), relativeTimeString: fallback };

  let date: Date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return { date: new Date(), relativeTimeString: fallback };
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
  if (!value) return value;
  return value[0].toUpperCase() + value.slice(1);
}

export function getMaskedApiKey(key: string): string {
  if (key.length <= 6) return "*".repeat(key.length);
  return `${key.slice(0, 3)}${"*".repeat(Math.max(0, key.length - 6))}${key.slice(-3)}`;
}

export function constructMetadata({
  title = SITE_CONFIG.NAME,
  description = SITE_CONFIG.DESCIPTION,
  icons = "/favicon.ico",
  noIndex = false,
}: {
  title?: string;
  description?: string;
  image?: string;
  icons?: string;
  noIndex?: boolean;
} = {}): Metadata {
  return {
    title,
    description,
    authors: [
      {
        name: "Snapflow",
      },
    ],
    icons,
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),
  };
}

export async function getBlurDataURL(url: string | null) {
  if (!url) return "data:image/webp;base64,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

  if (url.startsWith("/_static/")) url = `${env.NEXT_PUBLIC_WEBSITE_URL}${url}`;

  try {
    const response = await fetch(`https://wsrv.nl/?url=${url}&w=50&h=50&blur=5`);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    return `data:image/png;base64,${base64}`;
  } catch (error) {
    return "data:image/webp;base64,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  }
}

export const placeholderBlurhash =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAoJJREFUWEfFl4lu4zAMRO3cx/9/au6reMaOdkxTTl0grQFCRoqaT+SQotq2bV9N8rRt28xms87m83l553eZ/9vr9Wpkz+ezkT0ej+6dv1X81AFw7M4FBACPVn2c1Z3zLgDeJwHgeLFYdAARYioAEAKJEG2WAjl3gCwNYymQQ9b7/V4spmIAwO6Wy2VnAMikBWlDURBELf8CuN1uHQSrPwMAHK5WqwFELQ01AIXdAa7XawfAb3p6AOwK5+v1ugAoEq4FRSFLgavfQ49jAGQpAE5wjgGCeRrGdBArwHOPcwFcLpcGU1X0IsBuN5tNgYhaiFFwHTiAwq8I+O5xfj6fOz38K+X/fYAdb7fbAgFAjIJ6Aav3AYlQ6nfnDoDz0+lUxNiLALvf7XaDNGQ6GANQBKR85V27B4D3QQRw7hGIYlQKWGM79hSweyCUe1blXhEAogfABwHAXAcqSYkxCtHLUK3XBajSc4Dj8dilAeiSAgD2+30BAEKV4GKcAuDqB4TdYwBgPQByCgApUBoE4EJUGvxUjF3Q69/zLw3g/HA45ABKgdIQu+JPIyDnisCfAxAFNFM0EFNQ64gfS0EUoQP8ighrZSjn3oziZEQpauyKbfjbZchHUL/3AS/Dd30gAkxuRACgfO+EWQW8qwI1o+wseNuKcQiESjALvwNoMI0TcRzD4lFcPYwIM+JTF5x6HOs8yI7jeB5oKhpMRFH9UwaSCDB2Jmg4rc6E2TT0biIaG0rQhNqyhpHBcayTTSXH6vcDL7/sdqRK8LkwTsU499E8vRcAojHcZ4AxABdilgrp4lsXk8oVqgwh7+6H3phqd8J0Kk4vbx/+sZqCD/vNLya/5dT9fAH8g1WdNGgwbQAAAABJRU5ErkJggg==";
