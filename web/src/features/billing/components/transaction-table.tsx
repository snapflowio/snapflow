/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useCallback, useEffect, useState } from "react";
import type { WalletTransaction } from "@snapflow/api-client";
import { Receipt } from "lucide-react";
import { Skeleton } from "@/components/ui";
import { handleApiError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { apiClient } from "@/api/api-client";
import { formatDollars } from "@/constants/billing";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";

function formatDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TransactionTable() {
  const { selectedOrganization } = useSelectedOrganization();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    if (!selectedOrganization) return;
    setLoading(true);
    try {
      const response = await apiClient.billingApi.listWalletTransactions(selectedOrganization.id);
      setTransactions(response.data.slice(0, 10));
    } catch (error) {
      handleApiError(error, "Failed to fetch transactions");
    } finally {
      setLoading(false);
    }
  }, [selectedOrganization]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between border-border border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-3.5 w-3.5 text-text-icon" />
          <span className="font-medium text-[13px] text-text-body">Recent Transactions</span>
        </div>
      </div>

      {loading ? (
        <div className="divide-y divide-border/40">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-2.5">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="ml-auto h-3 w-16" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex items-center justify-center px-5 py-8">
          <span className="text-[13px] text-text-secondary">No transactions yet</span>
        </div>
      ) : (
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-border border-b">
              <th className="px-5 py-2 text-left font-medium text-text-muted">Description</th>
              <th className="px-5 py-2 text-right font-medium text-text-muted">Amount</th>
              <th className="px-5 py-2 text-right font-medium text-text-muted">Balance</th>
              <th className="px-5 py-2 text-right font-medium text-text-muted">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {transactions.map((tx) => (
              <tr key={tx.id} className="transition-colors hover:bg-surface-3">
                <td className="px-5 py-2.5 text-text-secondary">{tx.description}</td>
                <td
                  className={cn(
                    "px-5 py-2.5 text-right font-mono",
                    tx.amount < 0 ? "text-red-400" : "text-emerald-400"
                  )}
                >
                  {tx.amount < 0 ? "-" : "+"}
                  {formatDollars(Math.abs(tx.amount))}
                </td>
                <td className="px-5 py-2.5 text-right font-mono text-text-muted">
                  {formatDollars(tx.balanceAfter)}
                </td>
                <td className="px-5 py-2.5 text-right text-text-muted">
                  {formatDate(tx.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
