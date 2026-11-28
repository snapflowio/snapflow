/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { OptionalProps } from '@mikro-orm/core';
import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import type { Address } from 'viem';
import { EVM_ADDRESS_LENGTH } from '../constants/settlement.constants';
import {
	integerColumn,
	timestampColumn,
	updatedAtColumn,
} from '../utils/settlement-columns.util';

@Entity({ tableName: 'escrow_claims_freeze' })
export class EscrowClaimsFreeze {
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

	@Property(timestampColumn('frozenSince'))
	frozenSince: Date;

	@Property(timestampColumn('frozenUntil'))
	frozenUntil: Date;

	@Property(integerColumn('accumulatedSeconds'))
	accumulatedSeconds: number;

	@Property(updatedAtColumn)
	updatedAt: Date;
}
