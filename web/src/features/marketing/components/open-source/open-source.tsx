/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { GithubIcon } from "lucide-react";

function HeartIcon() {
  return (
    <div className="relative flex items-center justify-center">
      <div className="absolute h-30 w-30 animate-heartbeat-ring rounded-full bg-rose-500/5" />
      <div className="absolute h-22.5 w-22.5 animate-[heartbeat-ring_1.2s_ease-out_0.1s_infinite] rounded-full bg-rose-500/10" />
      <svg
        width="56"
        height="56"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 animate-heartbeat drop-shadow-[0_0_20px_rgba(244,63,94,0.25)]"
      >
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          className="fill-rose-500"
        />
      </svg>
    </div>
  );
}

export function OpenSource() {
  return (
    <section id="open-source" aria-labelledby="open-source-heading" className="bg-[#F6F6F6]">
      <div className="flex flex-col items-center px-4 py-24 sm:px-8 sm:py-32 md:px-20">
        <HeartIcon />
        <h2
          id="open-source-heading"
          className="mt-8 text-center font-[430] font-season text-[#1C1C1C] text-[28px] leading-[100%] tracking-[-0.02em] sm:text-[36px] md:text-[44px]"
        >
          Open Source
        </h2>
        <p className="mt-4 max-w-130 text-center font-[430] font-season text-[#5c5c5c] text-[15px] leading-[160%] tracking-[0.02em] lg:text-[17px]">
          Snapflow is proudly open source. Inspect the code, contribute features, self-host on your
          own infrastructure, or fork it to build something new.
        </p>

        <div className="mt-8 flex items-center gap-3">
          <a
            href="https://github.com/snapflowio/snapflow"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-2 rounded-[5px] border border-[#1D1D1D] bg-[#1D1D1D] px-3 font-[430] font-season text-[14px] text-white transition-colors hover:border-[#2A2A2A] hover:bg-[#2A2A2A]"
          >
            <GithubIcon className="h-3.5 w-3.5" />
            Star on GitHub
          </a>
          <a
            href="https://github.com/snapflowio/snapflow"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-2 rounded-[5px] border border-[#E5E5E5] px-3 font-[430] font-season text-[#1C1C1C] text-[14px] transition-colors hover:bg-[#F0F0F0]"
          >
            View source
          </a>
        </div>
      </div>
    </section>
  );
}
