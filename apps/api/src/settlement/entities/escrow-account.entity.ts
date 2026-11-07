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
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import type { Address } from 'viem';
import {
	addressColumn,
	amountColumn,
	timestampColumn,
} from '../utils/settlement-columns.util';

// Mirror of what the escrow holds for one address, folded from its confirmed
// events. It is keyed by address rather than organization so relinking a
// wallet never rewrites it; organizations reach it through their funding
// wallet. Amounts are USDC base units, which equal micro-USD.
@Entity({ tableName: 'escrow_account' })
@Unique({
	name: 'UQ_escrow_account_address',
	properties: ['chainId', 'contractAddress', 'address'],
})
export class EscrowAccount {
	[OptionalProps]?: 'id' | 'createdAt' | 'updatedAt';

	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Property({ type: 'integer', columnType: 'integer', fieldName: 'chainId' })
	chainId: number;

	@Property(addressColumn('contractAddress'))
	contractAddress: Address;

	@Property(addressColumn('address'))
	address: Address;

	@Property(amountColumn('balanceMicroUsd'))
	balanceMicroUsd: string;

	@Property(amountColumn('pendingWithdrawalMicroUsd'))
	pendingWithdrawalMicroUsd: string;

	@Property({ ...timestampColumn('withdrawalReadyAt'), nullable: true })
	withdrawalReadyAt: Date | null;

	@Property({ type: 'boolean', fieldName: 'blocked' })
	blocked: boolean;

	@Property({
		...timestampColumn('createdAt'),
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;

	@Property({
		...timestampColumn('updatedAt'),
		defaultRaw: 'now()',
		onCreate: () => new Date(),
		onUpdate: () => new Date(),
	})
	updatedAt: Date;
}
