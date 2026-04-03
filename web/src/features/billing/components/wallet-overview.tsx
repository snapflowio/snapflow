/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ArrowUpRight, Wallet } from "lucide-react";
import { Button } from "@/components/ui";
import { formatDollars } from "@/constants/billing";

interface WalletOverviewProps {
  balance: number;
}

export function WalletOverview({ balance }: WalletOverviewProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-text-muted">Balance</span>
          <span className="font-medium text-[24px] text-text-primary leading-none tracking-tight">
            {formatDollars(balance)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm">
            <Wallet className="mr-1.5 h-3.5 w-3.5" />
            Add Funds
          </Button>
          <Button variant="outline" size="sm">
            Manage
            <ArrowUpRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
