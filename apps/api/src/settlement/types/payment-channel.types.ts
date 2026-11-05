/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { BillingLineItem } from '../../billing/entities/billing-line-item.entity';
import type { MicroUsd } from '../../common/values/micro-usd.value';
import type { LinePrice } from '../../marketplace/types/pricing.types';

// Cumulative amounts of a lease's channel, as a voucher carries them.
export interface VoucherAmounts {
	hostMicroUsd: MicroUsd;
	feeMicroUsd: MicroUsd;
	serviceMicroUsd: MicroUsd;
}

export type ChargedLine = Pick<
	BillingLineItem,
	'beneficiaryKind' | 'grossMicroUsd' | 'hostMicroUsd' | 'markupMicroUsd'
>;

// Everything a lease has been charged so far: its billing lines and what its
// open usage periods accrued since they started.
export interface LeaseCharges {
	lines: readonly ChargedLine[];
	accruals: readonly LinePrice[];
}
