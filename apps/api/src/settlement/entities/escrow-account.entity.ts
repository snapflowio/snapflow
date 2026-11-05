/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { DecimalType, OptionalProps } from '@mikro-orm/core';
import {
	Entity,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import type { Address } from 'viem';
import { EVM_ADDRESS_LENGTH } from '../constants/settlement.constants';

const amountColumn = (fieldName: string) =>
	({
		type: new DecimalType('string'),
		columnType: 'numeric(40,0)',
		fieldName,
	}) as const;

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

	@Property({
		type: 'string',
		columnType: `varchar(${EVM_ADDRESS_LENGTH})`,
		fieldName: 'contractAddress',
	})
	contractAddress: Address;

	@Property({
		type: 'string',
		columnType: `varchar(${EVM_ADDRESS_LENGTH})`,
		fieldName: 'address',
	})
	address: Address;

	@Property(amountColumn('balanceMicroUsd'))
	balanceMicroUsd: string;

	@Property(amountColumn('pendingWithdrawalMicroUsd'))
	pendingWithdrawalMicroUsd: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'withdrawalReadyAt',
		nullable: true,
	})
	withdrawalReadyAt: Date | null;

	@Property({ type: 'boolean', fieldName: 'blocked' })
	blocked: boolean;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'updatedAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
		onUpdate: () => new Date(),
	})
	updatedAt: Date;
}
