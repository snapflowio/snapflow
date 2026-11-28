/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { PaymentChannel } from '../entities/payment-channel.entity';
import { PaymentVoucher } from '../entities/payment-voucher.entity';
import type { EscrowClaimItem } from '../types/escrow.types';
import type { HostSettlementItem } from '../types/host-settlement.types';
import { escrowClaimItem } from '../utils/settlements/host-settlement-call.util';

export async function settlementClaims(
	manager: EntityManager,
	items: readonly HostSettlementItem[]
): Promise<EscrowClaimItem[]> {
	if (items.length === 0) return [];
	const [channels, vouchers] = await Promise.all([
		manager.find(PaymentChannel, {
			id: { $in: items.map(({ paymentChannelId }) => paymentChannelId) },
		}),
		manager.find(PaymentVoucher, {
			id: { $in: items.map(({ voucherId }) => voucherId) },
		}),
	]);
	const channelById = new Map(channels.map((channel) => [channel.id, channel]));
	const voucherById = new Map(vouchers.map((voucher) => [voucher.id, voucher]));
	return items.map((item) => {
		const channel = channelById.get(item.paymentChannelId);
		const voucher = voucherById.get(item.voucherId);
		if (!channel || !voucher) {
			throw new Error(`Settlement item ${item.voucherId} no longer exists`);
		}
		return escrowClaimItem(channel, voucher, item.maxAmountMicroUsd);
	});
}
