"use client";

import type * as React from "react";
import { blockTypeToIconMap } from "@/components/ui/icons";

interface BlockInfoCardProps {
  type: string;
  color: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export function BlockInfoCard({
  type,
  color,
  icon: IconComponent,
}: BlockInfoCardProps): React.ReactNode {
  const ResolvedIcon = IconComponent || blockTypeToIconMap[type] || null;

  return (
    <div className="mb-6 overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-center p-6">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-lg"
          style={{ background: color }}
        >
          {ResolvedIcon ? (
            <ResolvedIcon className="h-10 w-10 text-white" />
          ) : (
            <div className="font-mono text-xl opacity-70">{type.substring(0, 2)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
