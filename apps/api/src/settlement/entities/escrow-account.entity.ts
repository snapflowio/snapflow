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
import type { AccountBlockReason } from '../enums/account-block-reason.enum';
import {
	addressColumn,
	amountColumn,
	timestampColumn,
} from '../utils/settlement-columns.util';

const AMOUNT_COLUMNS = [
	'freeMicroUsd',
	'pendingMicroUsd',
	'hostBalanceMicroUsd',
	'hostWithdrawnMicroUsd',
	'feesAccruedMicroUsd',
	'frozenMicroUsd',
] as const;

@Entity({ tableName: 'escrow_account' })
@Unique({
	name: 'UQ_escrow_account_address',
	properties: ['chainId', 'contractAddress', 'address'],
})
@Check({
	name: 'CHK_escrow_account_amounts',
	expression: AMOUNT_COLUMNS.map((column) => `"${column}" >= 0`).join(' and '),
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

	@Property(amountColumn('freeMicroUsd'))
	freeMicroUsd: string;

	@Property(amountColumn('pendingMicroUsd'))
	pendingMicroUsd: string;

	@Property({ ...timestampColumn('withdrawalUnlockAt'), nullable: true })
	withdrawalUnlockAt: Date | null;

	@Property(amountColumn('hostBalanceMicroUsd'))
	hostBalanceMicroUsd: string;

	@Property(amountColumn('hostWithdrawnMicroUsd'))
	hostWithdrawnMicroUsd: string;

	@Property(amountColumn('feesAccruedMicroUsd'))
	feesAccruedMicroUsd: string;

	@Property(amountColumn('frozenMicroUsd'))
	frozenMicroUsd: string;

	@Property({ ...timestampColumn('blockedAt'), nullable: true })
	blockedAt: Date | null;

	@Property({ ...timestampColumn('blockedUntil'), nullable: true })
	blockedUntil: Date | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'blockReason',
		nullable: true,
	})
	blockReason: AccountBlockReason | null;

	@Property({ ...addressColumn('payoutAddress'), nullable: true })
	payoutAddress: Address | null;

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
