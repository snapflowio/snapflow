/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BillingLedgerAccountCode } from '../../../../billing/ledger/constants/billing.constants';
import type { BillingLedgerAccountReference } from '../../../../billing/ledger/services/billing-ledger.service';
import { platformAccount } from '../../../../billing/ledger/utils/ledger/billing-ledger-accounts.util';

export function stripeBalance(): BillingLedgerAccountReference {
	return platformAccount(BillingLedgerAccountCode.STRIPE_BALANCE);
}

export function disputedFunds(): BillingLedgerAccountReference {
	return platformAccount(BillingLedgerAccountCode.DISPUTED_FUNDS);
}

export function disputeFees(): BillingLedgerAccountReference {
	return platformAccount(BillingLedgerAccountCode.DISPUTE_FEES);
}

export function payoutsInTransit(): BillingLedgerAccountReference {
	return platformAccount(BillingLedgerAccountCode.STRIPE_PAYOUTS_IN_TRANSIT);
}
