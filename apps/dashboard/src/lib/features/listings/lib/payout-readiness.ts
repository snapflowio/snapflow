/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type PaymentWallet,
	PaymentWalletPurpose,
	PayoutReadiness,
	SanctionsStatus,
} from '@snapflow/api-client';

export function payoutReadiness(
	wallets: readonly PaymentWallet[]
): PayoutReadiness {
	const wallet = wallets.find(
		(candidate) => candidate.purpose === PaymentWalletPurpose.Payout
	);
	if (!wallet) return PayoutReadiness.NotSetUp;
	return wallet.sanctionsStatus === SanctionsStatus.Blocked
		? PayoutReadiness.Blocked
		: PayoutReadiness.Ready;
}
