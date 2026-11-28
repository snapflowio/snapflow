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

@Entity({ tableName: 'escrow_signer' })
@Unique({
	name: 'UQ_escrow_signer',
	properties: ['chainId', 'contractAddress', 'signerAddress'],
})
@Index({
	name: 'IDX_escrow_signer_customer',
	properties: ['customerAddress'],
})
export class EscrowSigner {
	[OptionalProps]?: 'id' | 'createdAt' | 'updatedAt';

	@PrimaryKey(uuidPrimaryKey)
	id: string;

	@Property(integerColumn('chainId'))
	chainId: number;

	@Property(addressColumn('contractAddress'))
	contractAddress: Address;

	@Property(addressColumn('signerAddress'))
	signerAddress: Address;

	@Property(addressColumn('customerAddress'))
	customerAddress: Address;

	@Property(amountColumn('hourlyCap'))
	hourlyCap: string;

	@Property(amountColumn('pendingHourlyCap'))
	pendingHourlyCap: string;

	@Property({ ...timestampColumn('pendingEffectiveAt'), nullable: true })
	pendingEffectiveAt: Date | null;

	@Property(amountColumn('available'))
	available: string;

	@Property(integerColumn('remainder'))
	remainder: number;

	@Property(timestampColumn('budgetUpdatedAt'))
	budgetUpdatedAt: Date;

	@Property(timestampColumn('expiresAt'))
	expiresAt: Date;

	@Property(integerColumn('maxFeeBps'))
	maxFeeBps: number;

	@Property({ ...addressColumn('hostAddress'), nullable: true })
	hostAddress: Address | null;

	@Property({ ...timestampColumn('thawEndsAt'), nullable: true })
	thawEndsAt: Date | null;

	@Property({ ...timestampColumn('revokedAt'), nullable: true })
	revokedAt: Date | null;

	@Property(createdAtColumn)
	createdAt: Date;

	@Property(updatedAtColumn)
	updatedAt: Date;
}
