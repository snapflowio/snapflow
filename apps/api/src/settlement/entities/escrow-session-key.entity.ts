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

const addressColumn = (fieldName: string) =>
	({
		type: 'string',
		columnType: `varchar(${EVM_ADDRESS_LENGTH})`,
		fieldName,
	}) as const;

const amountColumn = (fieldName: string) =>
	({
		type: new DecimalType('string'),
		columnType: 'numeric(40,0)',
		fieldName,
	}) as const;

const timestampColumn = (fieldName: string) =>
	({ type: 'datetime', columnType: 'timestamptz(3)', fieldName }) as const;

// The keys a customer authorized on chain to sign vouchers for it, with the
// limits it set; a key is usable while it is not revoked and not expired.
@Entity({ tableName: 'escrow_session_key' })
@Unique({
	name: 'UQ_escrow_session_key',
	properties: ['chainId', 'contractAddress', 'customerAddress', 'keyAddress'],
})
export class EscrowSessionKey {
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

	@Property(addressColumn('customerAddress'))
	customerAddress: Address;

	@Property(addressColumn('keyAddress'))
	keyAddress: Address;

	@Property(amountColumn('spendCapMicroUsd'))
	spendCapMicroUsd: string;

	@Property(amountColumn('hourlyCapMicroUsd'))
	hourlyCapMicroUsd: string;

	@Property(timestampColumn('expiresAt'))
	expiresAt: Date;

	@Property(timestampColumn('activatedAt'))
	activatedAt: Date;

	@Property({ ...timestampColumn('revokedAt'), nullable: true })
	revokedAt: Date | null;

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
