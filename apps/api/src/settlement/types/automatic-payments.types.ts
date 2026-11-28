/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EscrowSigner } from '../entities/escrow-signer.entity';
import type { VoucherLimit } from '../enums/voucher-limit.enum';

export type AdmissionVoucherLimit = Exclude<
	VoucherLimit,
	typeof VoucherLimit.CUSTOMER_BALANCE
>;

export interface AdmissionSignerLimit {
	limit: AdmissionVoucherLimit;
	grant: EscrowSigner | null;
	hourlyCapMicroUsd: bigint | null;
}

export interface AutomaticPaymentsGap {
	limit: AdmissionVoucherLimit;
	hourlyCapMicroUsd: bigint | null;
	hourlySpendMicroUsd: bigint;
	expiresAt: Date | null;
}
