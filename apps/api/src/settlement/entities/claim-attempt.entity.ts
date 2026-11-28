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
	Entity,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import type { ClaimFailureReason } from '../constants/escrow.constants';
import {
	amountColumn,
	createdAtColumn,
	integerColumn,
	uuidPrimaryKey,
	varcharColumn,
} from '../utils/settlement-columns.util';
import { PaymentChannel } from './payment-channel.entity';
import { PaymentVoucher } from './payment-voucher.entity';
import { SettlementTransaction } from './settlement-transaction.entity';

@Entity({ tableName: 'claim_attempt' })
@Index({
	name: 'IDX_claim_attempt_channel',
	properties: ['paymentChannelId', 'createdAt'],
})
@Index({ name: 'IDX_claim_attempt_transaction', properties: ['transactionId'] })
export class ClaimAttempt {
	[OptionalProps]?: 'id' | 'createdAt';

	@PrimaryKey(uuidPrimaryKey)
	id: string;

	@ManyToOne({
		entity: () => SettlementTransaction,
		mapToPk: true,
		joinColumn: 'transactionId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_claim_attempt_transaction',
	})
	transactionId: string;

	@ManyToOne({
		entity: () => PaymentChannel,
		mapToPk: true,
		joinColumn: 'paymentChannelId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_claim_attempt_channel',
	})
	paymentChannelId: string;

	@ManyToOne({
		entity: () => PaymentVoucher,
		mapToPk: true,
		joinColumn: 'voucherId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_claim_attempt_voucher',
	})
	voucherId: string;

	@Property(integerColumn('itemIndex'))
	itemIndex: number;

	@Property(amountColumn('maxAmountMicroUsd'))
	maxAmountMicroUsd: string;

	@Property({ ...amountColumn('paidMicroUsd'), nullable: true })
	paidMicroUsd: string | null;

	@Property({ ...varcharColumn('failure'), nullable: true })
	failure: ClaimFailureReason | null;

	@Property(createdAtColumn)
	createdAt: Date;
}
