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
import type { Address, Hash } from 'viem';
import { Organization } from '../../organization/entities/organization.entity';
import {
	CLAIMED_EVENT,
	ESCROW_EVENT_KINDS,
} from '../constants/escrow.constants';
import {
	EVM_ADDRESS_LENGTH,
	EVM_HASH_LENGTH,
} from '../constants/settlement.constants';
import type { EscrowEventKind, StoredEscrowArgs } from '../types/escrow.types';

const addressColumn = (fieldName: string) =>
	({
		type: 'string',
		columnType: `varchar(${EVM_ADDRESS_LENGTH})`,
		fieldName,
	}) as const;

const hashColumn = (fieldName: string) =>
	({
		type: 'string',
		columnType: `varchar(${EVM_HASH_LENGTH})`,
		fieldName,
	}) as const;

const organizationColumn = (joinColumn: string, foreignKeyName: string) =>
	({
		entity: () => Organization,
		mapToPk: true,
		joinColumn,
		columnType: 'uuid',
		nullable: true,
		// An organization's history outlives it; a deleted organization's
		// events are already posted and only lose their owner.
		deleteRule: 'set null',
		updateRule: 'no action',
		foreignKeyName,
	}) as const;

// Every confirmed log the escrow emitted, stored once. The parties'
// organizations are filled in when their wallet is linked, at indexing time
// or later, and processedAt marks the event as projected into the ledger.
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
// Claims are summed per channel to know what each voucher still adds.
@Index({
	name: 'IDX_escrow_event_claimed_channel',
	expression: `create index "IDX_escrow_event_claimed_channel" on "escrow_event" ("chainId", "contractAddress", ("args"->>'channelId')) where "kind" = '${CLAIMED_EVENT}'`,
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

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'blockTimestamp',
	})
	blockTimestamp: Date;

	@Property({ type: 'string', columnType: 'varchar', fieldName: 'kind' })
	kind: EscrowEventKind;

	@Property({ type: 'json', columnType: 'jsonb', fieldName: 'args' })
	args: StoredEscrowArgs;

	@Property({ ...addressColumn('customerAddress'), nullable: true })
	customerAddress: Address | null;

	@Property({ ...addressColumn('hostAddress'), nullable: true })
	hostAddress: Address | null;

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

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'processedAt',
		nullable: true,
	})
	processedAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;
}
