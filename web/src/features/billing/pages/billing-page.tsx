/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useCallback, useEffect, useState } from "react";
import type { WalletOverview as WalletOverviewData } from "@snapflow/api-client";
import { CreditCard } from "lucide-react";
import { handleApiError } from "@/lib/errors";
import { apiClient } from "@/api/api-client";
import { BILLING_TIERS, getTierForBalance } from "@/constants/billing";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";
import { TierComparisonTable } from "../components/tier-comparison-table";
import { TransactionTable } from "../components/transaction-table";
import { UsageAndCost } from "../components/usage-and-cost";
import { WalletOverview } from "../components/wallet-overview";

export default function BillingPage() {
  const { selectedOrganization } = useSelectedOrganization();
  const [wallet, setWallet] = useState<WalletOverviewData | null>(null);

  const fetchWallet = useCallback(async () => {
    if (!selectedOrganization) return;
    try {
      const response = await apiClient.billingApi.getWalletOverview(selectedOrganization.id);
      setWallet(response.data);
    } catch (error) {
      handleApiError(error, "Failed to fetch wallet");
    }
  }, [selectedOrganization]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const balance = wallet?.balance ?? 0;
  const tier = getTierForBalance(balance);
  const allTiers = Object.values(BILLING_TIERS).filter((t) => t.id !== "enterprise");

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-bg">
      <div className="shrink-0 border-border border-b px-6 py-2.5">
        <div className="flex items-center gap-3">
          <CreditCard className="h-3.5 w-3.5 text-text-icon" />
          <h1 className="font-medium text-[14px] text-text-body">Billing</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-4 p-6">
          <WalletOverview balance={balance} />

          <UsageAndCost />

          <TransactionTable />

          <TierComparisonTable tiers={allTiers} currentTier={tier} />
        </div>
      </div>
    </div>
  );
}
