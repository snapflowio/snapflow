/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { OptionalProps } from '@mikro-orm/core';
import {
	Check,
	Entity,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import type { Address, Hex } from 'viem';
import {
	addressColumn,
	amountColumn,
	timestampColumn,
} from '../utils/settlement-columns.util';
import { PaymentChannel } from './payment-channel.entity';

// One voucher of a channel. Amounts are cumulative for the lease in USDC base
// units (micro-USD) and never decrease from one sequence to the next. A
// voucher is issued unsigned and becomes claimable once Snapflow's delegated
// signer or the customer's own key signed it.
@Entity({ tableName: 'payment_voucher' })
@Unique({
	name: 'UQ_payment_voucher_sequence',
	properties: ['paymentChannelId', 'sequence'],
})
@Index({
	name: 'IDX_payment_voucher_signer',
	properties: ['signerAddress', 'paymentChannelId', 'sequence'],
})
@Check({
	name: 'CHK_payment_voucher_sequence',
	expression: '"sequence" > 0',
})
@Check({
	name: 'CHK_payment_voucher_amounts',
	expression:
		'"hostAmountMicroUsd" >= 0 and "feeAmountMicroUsd" >= 0 and "serviceAmountMicroUsd" >= 0',
})
@Check({
	name: 'CHK_payment_voucher_signature',
	expression:
		'("signature" is null) = ("signerAddress" is null) and ("signature" is null) = ("signedAt" is null) and ("signature" is null) = ("claimableUntil" is null)',
})
export class PaymentVoucher {
	[OptionalProps]?: 'id' | 'createdAt';

	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@ManyToOne({
		entity: () => PaymentChannel,
		mapToPk: true,
		joinColumn: 'paymentChannelId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_payment_voucher_channel',
	})
	paymentChannelId: string;

	@Property({ type: 'integer', columnType: 'integer', fieldName: 'sequence' })
	sequence: number;

	@Property(amountColumn('hostAmountMicroUsd'))
	hostAmountMicroUsd: string;

	@Property(amountColumn('feeAmountMicroUsd'))
	feeAmountMicroUsd: string;

	@Property(amountColumn('serviceAmountMicroUsd'))
	serviceAmountMicroUsd: string;

	@Property(timestampColumn('issuedAt'))
	issuedAt: Date;

	// Whole seconds: the voucher's uint64 expiry.
	@Property(timestampColumn('expiresAt'))
	expiresAt: Date;

	@Property({ ...addressColumn('signerAddress'), nullable: true })
	signerAddress: Address | null;

	@Property({
		type: 'text',
		columnType: 'text',
		fieldName: 'signature',
		nullable: true,
	})
	signature: Hex | null;

	@Property({ ...timestampColumn('signedAt'), nullable: true })
	signedAt: Date | null;

	// The voucher's expiry, or earlier when the session key that signed it
	// expires first and the escrow would refuse it from then on.
	@Property({ ...timestampColumn('claimableUntil'), nullable: true })
	claimableUntil: Date | null;

	@Property({
		...timestampColumn('createdAt'),
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;
}
