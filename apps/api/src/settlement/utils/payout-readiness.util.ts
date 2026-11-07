/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { PaymentWallet } from '../entities/payment-wallet.entity';
import { PayoutReadiness } from '../enums/payout-readiness.enum';
import { SanctionsStatus } from '../enums/sanctions-status.enum';

// A wallet only exists once its owner proved control of it, so a linked payout
// wallet is ready unless screening blocked it. Unchecked wallets only occur
// where screening is disabled (development) and count as ready there.
export function payoutReadiness(
	wallet: Pick<PaymentWallet, 'sanctionsStatus'> | null
): PayoutReadiness {
	if (!wallet) return PayoutReadiness.NOT_SET_UP;
	return wallet.sanctionsStatus === SanctionsStatus.BLOCKED
		? PayoutReadiness.BLOCKED
		: PayoutReadiness.READY;
}
