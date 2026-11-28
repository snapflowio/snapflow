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
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import type { Address } from 'viem';
import {
	addressColumn,
	amountColumn,
	createdAtColumn,
	integerColumn,
	timestampColumn,
	updatedAtColumn,
	uuidPrimaryKey,
} from '../utils/settlement-columns.util';

@Entity({ tableName: 'escrow_auto_top_up' })
@Unique({
	name: 'UQ_escrow_auto_top_up_customer',
	properties: ['chainId', 'contractAddress', 'customerAddress'],
})
@Check({
	name: 'CHK_escrow_auto_top_up_amounts',
	expression:
		'"amountMicroUsd" > 0 and "thresholdMicroUsd" > 0 and "maxRelayFeeMicroUsd" >= 0 and "minIntervalSeconds" > 0',
})
export class EscrowAutoTopUp {
	[OptionalProps]?: 'id' | 'lastTopUpAt' | 'createdAt' | 'updatedAt';

	@PrimaryKey(uuidPrimaryKey)
	id: string;

	@Property({ type: 'integer', columnType: 'integer', fieldName: 'chainId' })
	chainId: number;

	@Property(addressColumn('contractAddress'))
	contractAddress: Address;

	@Property(addressColumn('customerAddress'))
	customerAddress: Address;

	@Property(addressColumn('relayerAddress'))
	relayerAddress: Address;

	@Property(amountColumn('amountMicroUsd'))
	amountMicroUsd: string;

	@Property(amountColumn('thresholdMicroUsd'))
	thresholdMicroUsd: string;

	@Property(amountColumn('maxRelayFeeMicroUsd'))
	maxRelayFeeMicroUsd: string;

	@Property(integerColumn('minIntervalSeconds'))
	minIntervalSeconds: number;

	@Property({ ...timestampColumn('lastTopUpAt'), nullable: true })
	lastTopUpAt: Date | null = null;

	@Property(createdAtColumn)
	createdAt: Date;

	@Property(updatedAtColumn)
	updatedAt: Date;
}
