/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useRef, useState } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { Path } from "@/constants/paths";

interface TemplateItem {
  id: string;
  name: string;
  color: string;
  description: string;
}

const TEMPLATES: TemplateItem[] = [
  {
    id: "tpl-ai-sandbox",
    name: "AI Code Sandbox",
    color: "#2ABBF8",
    description: "Execute untrusted code safely in an isolated sandbox with full system access.",
  },
  {
    id: "tpl-web-scraper",
    name: "Web Scraper Agent",
    color: "#00F701",
    description: "Scrape and extract data from websites using headless browsers in sandboxes.",
  },
  {
    id: "tpl-ci-runner",
    name: "CI Test Runner",
    color: "#FFCC02",
    description: "Run test suites in ephemeral environments with automatic cleanup.",
  },
  {
    id: "tpl-data-pipeline",
    name: "Data Pipeline",
    color: "#FA4EDF",
    description: "Process and transform data streams through sandboxed compute stages.",
  },
  {
    id: "tpl-threat-analysis",
    name: "Threat Analysis",
    color: "#FF6B2C",
    description: "Safely analyze suspicious files and URLs in isolated environments.",
  },
  {
    id: "tpl-notebook",
    name: "Interactive Notebook",
    color: "#6366F1",
    description: "Run Jupyter-style notebooks with persistent state and file access.",
  },
  {
    id: "tpl-api-testing",
    name: "API Load Tester",
    color: "#F43F5E",
    description: "Stress test APIs from distributed sandbox instances.",
  },
  {
    id: "tpl-ml-training",
    name: "ML Training Job",
    color: "#14B8A6",
    description: "Train models in GPU-enabled sandboxes with artifact storage.",
  },
];

function hexToRgba(hex: string, alpha: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const LEFT_WALL_CLIP = "polygon(0 8px, 100% 0, 100% 100%, 0 100%)";
const BOTTOM_WALL_CLIP = "polygon(0 0, 100% 0, calc(100% - 8px) 100%, 0 100%)";

interface DepthConfig {
  color: string;
  segments: readonly (readonly [opacity: number, width: number])[];
}

const DEPTH_CONFIGS: Record<string, DepthConfig> = {
  "tpl-ai-sandbox": {
    color: "#2ABBF8",
    segments: [
      [0.3, 10],
      [0.5, 8],
      [0.8, 6],
      [1, 5],
      [0.4, 12],
      [0.7, 8],
      [1, 6],
      [0.5, 10],
      [0.9, 7],
      [0.6, 12],
      [1, 8],
      [0.35, 8],
    ],
  },
  "tpl-web-scraper": {
    color: "#00F701",
    segments: [
      [0.4, 8],
      [0.7, 6],
      [1, 5],
      [0.5, 14],
      [0.85, 8],
      [0.3, 12],
      [1, 6],
      [0.6, 10],
      [0.9, 7],
      [0.45, 8],
      [1, 8],
      [0.7, 8],
    ],
  },
  "tpl-ci-runner": {
    color: "#FFCC02",
    segments: [
      [0.5, 12],
      [0.8, 6],
      [0.35, 10],
      [1, 5],
      [0.6, 8],
      [0.9, 7],
      [0.4, 14],
      [1, 6],
      [0.7, 10],
      [0.5, 8],
      [1, 6],
      [0.3, 8],
    ],
  },
  "tpl-data-pipeline": {
    color: "#FA4EDF",
    segments: [
      [0.35, 6],
      [0.6, 10],
      [0.9, 5],
      [1, 6],
      [0.4, 8],
      [0.75, 12],
      [0.5, 7],
      [1, 5],
      [0.3, 10],
      [0.8, 8],
      [0.6, 9],
      [1, 6],
      [0.45, 8],
    ],
  },
  "tpl-threat-analysis": {
    color: "#FF6B2C",
    segments: [
      [0.4, 10],
      [0.7, 8],
      [1, 5],
      [0.5, 12],
      [0.85, 6],
      [0.3, 10],
      [1, 6],
      [0.6, 8],
      [0.9, 7],
      [0.4, 12],
      [1, 8],
      [0.65, 8],
    ],
  },
  "tpl-notebook": {
    color: "#6366F1",
    segments: [
      [0.3, 8],
      [0.55, 10],
      [0.8, 6],
      [1, 5],
      [0.4, 12],
      [0.7, 7],
      [0.9, 8],
      [0.5, 10],
      [1, 6],
      [0.35, 8],
      [0.75, 6],
      [1, 6],
      [0.6, 8],
    ],
  },
  "tpl-api-testing": {
    color: "#F43F5E",
    segments: [
      [0.5, 10],
      [0.8, 6],
      [0.4, 8],
      [1, 5],
      [0.6, 12],
      [0.35, 8],
      [0.9, 7],
      [1, 6],
      [0.5, 10],
      [0.75, 8],
      [0.4, 6],
      [1, 6],
      [0.65, 8],
    ],
  },
  "tpl-ml-training": {
    color: "#14B8A6",
    segments: [
      [0.35, 8],
      [0.6, 6],
      [0.9, 5],
      [0.4, 12],
      [1, 6],
      [0.7, 10],
      [0.5, 7],
      [0.85, 8],
      [1, 5],
      [0.3, 10],
      [0.65, 8],
      [1, 7],
      [0.5, 8],
    ],
  },
};

function buildBottomWallStyle(config: DepthConfig) {
  let pos = 0;
  const stops: string[] = [];
  for (const [opacity, width] of config.segments) {
    const c = hexToRgba(config.color, opacity);
    stops.push(`${c} ${pos}%`, `${c} ${pos + width}%`);
    pos += width;
  }
  return {
    clipPath: BOTTOM_WALL_CLIP,
    background: `linear-gradient(135deg, ${stops.join(", ")})`,
  };
}

function DotGrid({
  className,
  cols,
  rows,
  gap = 0,
}: {
  className?: string;
  cols: number;
  rows: number;
  gap?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap,
        placeItems: "center",
      }}
    >
      {Array.from({ length: cols * rows }, (_, i) => (
        <div key={i} className="h-[1.5px] w-[1.5px] rounded-full bg-surface-active" />
      ))}
    </div>
  );
}

const TEMPLATES_PANEL_ID = "templates-panel";

export function Templates() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const active = TEMPLATES[activeIndex];

  return (
    <section
      ref={sectionRef}
      id="templates"
      aria-labelledby="templates-heading"
      className="mt-10 mb-20"
    >
      <div className="bg-bg">
        <DotGrid
          className="overflow-hidden border-border border-y bg-bg p-1.5"
          cols={160}
          rows={1}
          gap={6}
        />

        <div className="relative overflow-hidden">
          {/* Section header */}
          <div className="px-5 pt-15 lg:px-20 lg:pt-25">
            <div className="flex flex-col items-start gap-5">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.75 font-season text-[11px] uppercase tracking-[0.02em]"
                style={{
                  color: active.color,
                  backgroundColor: hexToRgba(active.color, 0.1),
                }}
              >
                <span
                  className="h-1.25 w-1.25 rounded-full"
                  style={{ backgroundColor: active.color }}
                />
                Use Cases
              </span>

              <h2
                id="templates-heading"
                className="font-[430] font-season text-[28px] text-white leading-[100%] tracking-[-0.02em] lg:text-[40px]"
              >
                Built for every workload
              </h2>

              <p className="font-[430] font-season text-[15px] text-text-primary/50 leading-[150%] tracking-[0.02em] lg:text-[18px]">
                Pre-configured sandbox environments for common use cases—pick one,
                <br className="hidden lg:inline" />
                customize it, and deploy in seconds.
              </p>
            </div>
          </div>

          {/* Template selector + preview */}
          <div className="mt-10 flex border-border border-y lg:mt-18.25">
            {/* Left dot grid */}
            <div className="shrink-0">
              <div className="h-full lg:hidden">
                <DotGrid
                  className="h-full w-6 overflow-hidden border-border border-r p-1"
                  cols={2}
                  rows={55}
                  gap={4}
                />
              </div>
              <div className="hidden h-full lg:block">
                <DotGrid
                  className="h-full w-20 overflow-hidden border-border border-r p-1.5"
                  cols={8}
                  rows={55}
                  gap={6}
                />
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col lg:flex-row">
              {/* Tab list */}
              <div
                role="tablist"
                aria-label="Use case templates"
                className="flex w-full shrink-0 flex-col border-border lg:w-75 lg:border-r"
              >
                {TEMPLATES.map((template, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <button
                      key={template.id}
                      id={`template-tab-${index}`}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-controls={TEMPLATES_PANEL_ID}
                      onClick={() => setActiveIndex(index)}
                      className={cn(
                        "relative w-full text-left",
                        isActive
                          ? "z-10"
                          : cn(
                              "flex items-center px-3 py-2.5 hover:bg-surface-2/50",
                              index < TEMPLATES.length - 1 &&
                                "shadow-[inset_0_-1px_0_0_var(--border)]"
                            )
                      )}
                    >
                      {isActive ? (
                        (() => {
                          const depth = DEPTH_CONFIGS[template.id];
                          return (
                            <>
                              <div
                                className="absolute -top-2 bottom-0 left-0 w-2"
                                style={{
                                  clipPath: LEFT_WALL_CLIP,
                                  backgroundColor: hexToRgba(depth.color, 0.63),
                                }}
                              />
                              <div
                                className="absolute -right-2 bottom-0 left-2 h-2"
                                style={buildBottomWallStyle(depth)}
                              />
                              <div className="relative flex translate-x-2 -translate-y-2 items-center bg-surface-3 px-3 py-2.5 shadow-[inset_0_0_0_1.5px_var(--border-1)]">
                                <span className="flex-1 font-[430] font-season text-[16px] text-white">
                                  {template.name}
                                </span>
                                <svg
                                  width="11"
                                  height="11"
                                  viewBox="0 0 11 7"
                                  fill="none"
                                  className="shrink-0 -rotate-90"
                                  style={{ color: depth.color }}
                                >
                                  <path
                                    d="M1 1L5.5 5.5L10 1"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </div>
                            </>
                          );
                        })()
                      ) : (
                        <span className="font-[430] font-season text-[16px] text-text-primary/50">
                          {template.name}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Preview panel */}
              <div
                id={TEMPLATES_PANEL_ID}
                role="tabpanel"
                aria-labelledby={`template-tab-${activeIndex}`}
                className="relative hidden flex-1 lg:block"
              >
                <div className="flex h-full flex-col items-center justify-center gap-4 bg-bg p-10">
                  <div
                    className="h-1.5 w-10 rounded-full"
                    style={{ backgroundColor: hexToRgba(active.color, 0.4) }}
                  />
                  <p className="max-w-90 text-center font-[430] font-season text-[15px] text-text-primary/40 leading-[150%]">
                    {active.description}
                  </p>
                  <Link
                    to={Path.SIGNUP}
                    className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-[5px] border border-[#FFFFFF] bg-[#FFFFFF] px-2.5 font-[430] font-season text-[14px] text-black transition-colors hover:border-[#E0E0E0] hover:bg-[#E0E0E0]"
                  >
                    Try it out
                  </Link>
                </div>
              </div>

              {/* Mobile: show description below active tab */}
              <div className="border-border border-t p-4 lg:hidden">
                <p className="font-[430] font-season text-[14px] text-text-primary/40 leading-[150%]">
                  {active.description}
                </p>
                <Link
                  to={Path.SIGNUP}
                  className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-[5px] border border-[#FFFFFF] bg-[#FFFFFF] font-[430] font-season text-[14px] text-black transition-colors active:bg-[#E0E0E0]"
                >
                  Try it out
                </Link>
              </div>
            </div>

            {/* Right dot grid */}
            <div className="shrink-0">
              <div className="h-full lg:hidden">
                <DotGrid
                  className="h-full w-6 overflow-hidden border-border border-l p-1"
                  cols={2}
                  rows={55}
                  gap={4}
                />
              </div>
              <div className="hidden h-full lg:block">
                <DotGrid
                  className="h-full w-20 overflow-hidden border-border border-l p-1.5"
                  cols={8}
                  rows={55}
                  gap={6}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
