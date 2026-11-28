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
	createdAtColumn,
	hashColumn,
	integerColumn,
	textColumn,
	timestampColumn,
	uuidPrimaryKey,
} from '../utils/settlement-columns.util';
import { PaymentChannel } from './payment-channel.entity';

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
	name: 'CHK_payment_voucher_amount',
	expression: '"sequence" > 0 and "cumulativeMicroUsd" > 0',
})
@Check({
	name: 'CHK_payment_voucher_signature',
	expression:
		'("signature" is null) = ("signerAddress" is null) and ("signature" is null) = ("signedAt" is null)',
})
export class PaymentVoucher {
	[OptionalProps]?: 'id' | 'createdAt';

	@PrimaryKey(uuidPrimaryKey)
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

	@Property(integerColumn('sequence'))
	sequence: number;

	@Property(amountColumn('cumulativeMicroUsd'))
	cumulativeMicroUsd: string;

	@Property(timestampColumn('timestamp'))
	timestamp: Date;

	@Property(hashColumn('metadata'))
	metadata: Hex;

	@Property(hashColumn('digest'))
	digest: Hex;

	@Property({ ...addressColumn('signerAddress'), nullable: true })
	signerAddress: Address | null;

	@Property({ ...textColumn('signature'), nullable: true })
	signature: Hex | null;

	@Property({ ...timestampColumn('signedAt'), nullable: true })
	signedAt: Date | null;

	@Property(createdAtColumn)
	createdAt: Date;
}
