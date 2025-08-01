"use client";

import Link from "next/link";

interface AnnouncementBannerProps {
  text: string;
  href: string;
  logo?: React.ReactNode;
}

export function AnnouncementBanner({ text, href, logo }: AnnouncementBannerProps) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex w-3/4 cursor-pointer items-center justify-between overflow-hidden rounded-lg border bg-background p-3 transition-colors duration-300"
    >
      <div
        className="absolute inset-0 h-full w-full bg-repeat"
        style={{
          backgroundImage: `repeating-linear-gradient(-45deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03) 1px, transparent 1px, transparent 8px)`,
          backgroundSize: "10px 10px",
        }}
      />

      <div className="relative z-10 flex items-center space-x-3">
        {logo}
        <p className="font-mono text-gray-300 text-sm transition-colors duration-300 group-hover:text-primary">
          {text}
        </p>
      </div>
      <div className="relative z-10">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 text-gray-500 transition-colors duration-300 group-hover:text-primary"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </div>
    </Link>
  );
}
