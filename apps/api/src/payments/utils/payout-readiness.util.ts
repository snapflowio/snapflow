/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { PaymentAccount } from '../entities/payment-account.entity';
import {
	PaymentAccountRequirementsStatus,
	PaymentAccountTransfersStatus,
} from '../enums/payment-account-status.enum';
import { PayoutReadiness } from '../enums/payout-readiness.enum';
import { payoutAccountEligible } from './payout.util';

const ACTION_REQUIRED_REQUIREMENTS: readonly PaymentAccountRequirementsStatus[] =
	[
		PaymentAccountRequirementsStatus.CURRENTLY_DUE,
		PaymentAccountRequirementsStatus.PAST_DUE,
	];

export function payoutReadiness(
	account: Pick<
		PaymentAccount,
		'transfersStatus' | 'requirementsStatus' | 'payoutsBlockedReason'
	> | null
): PayoutReadiness {
	if (!account) return PayoutReadiness.NOT_SET_UP;
	if (payoutAccountEligible(account)) return PayoutReadiness.READY;
	if (
		account.transfersStatus === PaymentAccountTransfersStatus.RESTRICTED ||
		account.payoutsBlockedReason !== null ||
		ACTION_REQUIRED_REQUIREMENTS.includes(account.requirementsStatus)
	) {
		return PayoutReadiness.ACTION_REQUIRED;
	}
	return PayoutReadiness.PENDING;
}
