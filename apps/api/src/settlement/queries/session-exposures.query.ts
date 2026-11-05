/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import type { Hex } from 'viem';
import { MicroUsd } from '../../common/values/micro-usd.value';
import type { EscrowSessionKey } from '../entities/escrow-session-key.entity';
import type { PaymentChannel } from '../entities/payment-channel.entity';
import type { EscrowIdentity } from '../types/escrow.types';
import type { SessionExposure } from '../utils/session-allowance.util';
import {
	voucherTotal,
	ZERO_VOUCHER_AMOUNTS,
} from '../utils/voucher-amounts.util';
import { claimedAmounts } from './claimed-amounts.query';

interface SignedTotalRow {
	paymentChannelId: string;
	channelId: Hex;
	signedMicroUsd: string;
}

export type SessionKeyIdentity = Pick<
	EscrowSessionKey,
	'customerAddress' | 'keyAddress' | 'activatedAt'
>;

// The exposure of a session key on every channel of its customer it signed
// on, plus the channel about to be signed, whatever it signed there so far.
export async function sessionExposures(
	manager: EntityManager,
	escrow: EscrowIdentity,
	key: SessionKeyIdentity,
	pending: Pick<PaymentChannel, 'id' | 'channelId'>
): Promise<SessionExposure[]> {
	const rows = await manager.execute<SignedTotalRow[]>(
		`SELECT DISTINCT ON (voucher."paymentChannelId")
				voucher."paymentChannelId" AS "paymentChannelId",
				channel."channelId" AS "channelId",
				voucher."hostAmountMicroUsd" + voucher."feeAmountMicroUsd"
					+ voucher."serviceAmountMicroUsd" AS "signedMicroUsd"
		 FROM payment_voucher voucher
		 INNER JOIN payment_channel channel ON channel.id = voucher."paymentChannelId"
		 WHERE channel."chainId" = ? AND channel."contractAddress" = ?
		   AND channel."customerAddress" = ? AND voucher."signerAddress" = ?
		 ORDER BY voucher."paymentChannelId", voucher.sequence DESC`,
		[
			escrow.chainId,
			escrow.contractAddress,
			key.customerAddress,
			key.keyAddress,
		]
	);
	const signed: SignedTotalRow[] = rows.some(
		(row) => row.paymentChannelId === pending.id
	)
		? rows
		: [
				...rows,
				{
					paymentChannelId: pending.id,
					channelId: pending.channelId,
					signedMicroUsd: MicroUsd.ZERO.toString(),
				},
			];
	const claimed = await claimedAmounts(
		manager,
		escrow,
		signed.map((row) => row.channelId),
		key.activatedAt
	);
	return signed.map((row) => ({
		paymentChannelId: row.paymentChannelId,
		signedMicroUsd: MicroUsd.parse(row.signedMicroUsd),
		claimedBeforeActivationMicroUsd: voucherTotal(
			claimed.get(row.channelId) ?? ZERO_VOUCHER_AMOUNTS
		),
	}));
}
