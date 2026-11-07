/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { PaymentVoucher } from '../entities/payment-voucher.entity';

export const VoucherSelection = {
	ANY: 'any',
	SIGNED: 'signed',
} as const;

export type VoucherSelection =
	(typeof VoucherSelection)[keyof typeof VoucherSelection];

const SELECTION_CONDITION: Readonly<Record<VoucherSelection, string>> = {
	[VoucherSelection.ANY]: 'true',
	[VoucherSelection.SIGNED]: '"signature" IS NOT NULL',
};

// The highest-sequence voucher of each channel, keyed by channel row id.
export async function latestVouchers(
	manager: EntityManager,
	paymentChannelIds: readonly string[],
	selection: VoucherSelection
): Promise<Map<string, PaymentVoucher>> {
	if (paymentChannelIds.length === 0) return new Map();
	const rows = await manager.execute<{ id: string }[]>(
		`SELECT DISTINCT ON ("paymentChannelId") id
		 FROM payment_voucher
		 WHERE "paymentChannelId" IN (?) AND ${SELECTION_CONDITION[selection]}
		 ORDER BY "paymentChannelId", sequence DESC`,
		[paymentChannelIds]
	);
	if (rows.length === 0) return new Map();
	const vouchers = await manager.find(PaymentVoucher, {
		id: { $in: rows.map(({ id }) => id) },
	});
	return new Map(
		vouchers.map((voucher) => [voucher.paymentChannelId, voucher])
	);
}
