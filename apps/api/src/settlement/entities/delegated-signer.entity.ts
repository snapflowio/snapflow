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
	Unique,
} from '@mikro-orm/decorators/legacy';
import type { Address } from 'viem';
import { Organization } from '../../organization/entities/organization.entity';
import {
	addressColumn,
	createdAtColumn,
	integerColumn,
	textColumn,
	timestampColumn,
	uuidPrimaryKey,
} from '../utils/settlement-columns.util';

@Entity({ tableName: 'delegated_signer' })
@Index({
	name: 'UQ_delegated_signer_active_customer',
	expression:
		'create unique index "UQ_delegated_signer_active_customer" on "delegated_signer" ("chainId", "contractAddress", "customerAddress") where "retiredAt" is null',
})
@Unique({
	name: 'UQ_delegated_signer_signer',
	properties: ['chainId', 'contractAddress', 'signerAddress'],
})
export class DelegatedSigner {
	[OptionalProps]?: 'id' | 'createdAt' | 'retiredAt';

	@PrimaryKey(uuidPrimaryKey)
	id: string;

	@Property(integerColumn('chainId'))
	chainId: number;

	@Property(addressColumn('contractAddress'))
	contractAddress: Address;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'organizationId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_delegated_signer_organization',
	})
	organizationId: string;

	@Property(addressColumn('customerAddress'))
	customerAddress: Address;

	@Property(addressColumn('signerAddress'))
	signerAddress: Address;

	@Property(textColumn('encryptedPrivateKey'))
	encryptedPrivateKey: string;

	@Property({ ...timestampColumn('retiredAt'), nullable: true })
	retiredAt: Date | null;

	@Property(createdAtColumn)
	createdAt: Date;
}
