/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BigIntType, OptionalProps } from '@mikro-orm/core';
import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import type { Address } from 'viem';
import { EVM_ADDRESS_LENGTH } from '../constants/settlement.constants';

// The last block whose escrow events are stored; it only advances in the
// transaction that stores them.
@Entity({ tableName: 'settlement_chain_cursor' })
export class SettlementChainCursor {
	[OptionalProps]?: 'updatedAt';

	@PrimaryKey({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'chainId',
		autoincrement: false,
	})
	chainId: number;

	@PrimaryKey({
		type: 'string',
		columnType: `varchar(${EVM_ADDRESS_LENGTH})`,
		fieldName: 'contractAddress',
	})
	contractAddress: Address;

	@Property({
		type: new BigIntType('number'),
		columnType: 'bigint',
		fieldName: 'lastIndexedBlock',
	})
	lastIndexedBlock: number;

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
