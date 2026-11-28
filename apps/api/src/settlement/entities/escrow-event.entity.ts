/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BigIntType, OptionalProps } from '@mikro-orm/core';
import {
	Check,
	Entity,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import type { Address, Hash, Hex } from 'viem';
import { Organization } from '../../organization/entities/organization.entity';
import { ESCROW_EVENT_KINDS } from '../constants/escrow.constants';
import type {
	EscrowEventKind,
	EscrowMovement,
	StoredEscrowArgs,
} from '../types/escrow.types';
import {
	addressColumn,
	hashColumn,
	timestampColumn,
} from '../utils/settlement-columns.util';

const organizationColumn = (joinColumn: string, foreignKeyName: string) =>
	({
		entity: () => Organization,
		mapToPk: true,
		joinColumn,
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'set null',
		updateRule: 'no action',
		foreignKeyName,
	}) as const;

@Entity({ tableName: 'escrow_event' })
@Unique({
	name: 'UQ_escrow_event_log',
	properties: ['chainId', 'transactionHash', 'logIndex'],
})
@Index({
	name: 'IDX_escrow_event_customer_organization',
	properties: ['customerOrganizationId', 'blockNumber', 'logIndex'],
})
@Index({
	name: 'IDX_escrow_event_host_organization',
	properties: ['hostOrganizationId', 'blockNumber', 'logIndex'],
})
@Index({
	name: 'IDX_escrow_event_customer_address',
	properties: ['customerAddress'],
})
@Index({
	name: 'IDX_escrow_event_host_address',
	properties: ['hostAddress'],
})
@Index({
	name: 'IDX_escrow_event_channel',
	properties: ['chainId', 'contractAddress', 'channelId'],
})
@Check({
	name: 'CHK_escrow_event_kind',
	expression: `"kind" in (${ESCROW_EVENT_KINDS.map((kind) => `'${kind}'`).join(', ')})`,
})
export class EscrowEvent {
	[OptionalProps]?: 'id' | 'createdAt';

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

	@Property(hashColumn('transactionHash'))
	transactionHash: Hash;

	@Property({ type: 'integer', columnType: 'integer', fieldName: 'logIndex' })
	logIndex: number;

	@Property({
		type: new BigIntType('number'),
		columnType: 'bigint',
		fieldName: 'blockNumber',
	})
	blockNumber: number;

	@Property(hashColumn('blockHash'))
	blockHash: Hash;

	@Property(timestampColumn('blockTimestamp'))
	blockTimestamp: Date;

	@Property({ type: 'string', columnType: 'varchar', fieldName: 'kind' })
	kind: EscrowEventKind;

	@Property({ type: 'json', columnType: 'jsonb', fieldName: 'args' })
	args: StoredEscrowArgs;

	@Property({ ...addressColumn('customerAddress'), nullable: true })
	customerAddress: Address | null;

	@Property({ ...addressColumn('hostAddress'), nullable: true })
	hostAddress: Address | null;

	@Property({ ...hashColumn('channelId'), nullable: true })
	channelId: Hex | null;

	@Property({ type: 'json', columnType: 'jsonb', fieldName: 'movements' })
	movements: EscrowMovement[];

	@ManyToOne(
		organizationColumn(
			'customerOrganizationId',
			'FK_escrow_event_customer_organization'
		)
	)
	customerOrganizationId: string | null;

	@ManyToOne(
		organizationColumn(
			'hostOrganizationId',
			'FK_escrow_event_host_organization'
		)
	)
	hostOrganizationId: string | null;

	@Property({ ...timestampColumn('processedAt'), nullable: true })
	processedAt: Date | null;

	@Property({
		...timestampColumn('createdAt'),
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;
}
