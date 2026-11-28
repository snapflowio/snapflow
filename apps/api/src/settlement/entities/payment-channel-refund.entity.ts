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
import type { Hash } from 'viem';
import { User } from '../../user/entities/user.entity';
import {
	amountColumn,
	createdAtColumn,
	hashColumn,
	uuidPrimaryKey,
} from '../utils/settlement-columns.util';
import { PaymentChannel } from './payment-channel.entity';

@Entity({ tableName: 'payment_channel_refund' })
@Unique({
	name: 'UQ_payment_channel_refund_transaction_channel',
	properties: ['transactionHash', 'paymentChannelId'],
})
@Index({
	name: 'IDX_payment_channel_refund_channel',
	properties: ['paymentChannelId', 'refundedAt'],
})
@Check({
	name: 'CHK_payment_channel_refund_amount',
	expression: '"amountMicroUsd" > 0',
})
export class PaymentChannelRefund {
	[OptionalProps]?: 'id' | 'refundedAt';

	@PrimaryKey(uuidPrimaryKey)
	id: string;

	@ManyToOne({
		entity: () => PaymentChannel,
		mapToPk: true,
		joinColumn: 'paymentChannelId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_payment_channel_refund_channel',
	})
	paymentChannelId: string;

	@Property(amountColumn('amountMicroUsd'))
	amountMicroUsd: string;

	@Property(hashColumn('transactionHash'))
	transactionHash: Hash;

	@ManyToOne({
		entity: () => User,
		mapToPk: true,
		joinColumn: 'refundedByUserId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'set null',
		updateRule: 'no action',
		foreignKeyName: 'FK_payment_channel_refund_user',
	})
	refundedByUserId: string | null;

	@Property({ ...createdAtColumn, fieldName: 'refundedAt' })
	refundedAt: Date;
}
