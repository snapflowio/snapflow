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
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import type { Address, Hash, Hex } from 'viem';
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import { SandboxLease } from '../../marketplace/entities/sandbox-lease.entity';
import { Organization } from '../../organization/entities/organization.entity';
import {
	EVM_ADDRESS_LENGTH,
	EVM_HASH_LENGTH,
} from '../constants/settlement.constants';
import { PaymentChannelKind } from '../enums/payment-channel-kind.enum';
import { PaymentChannelState } from '../enums/payment-channel-state.enum';
import { VoucherSigningMode } from '../enums/voucher-signing-mode.enum';

const addressColumn = (fieldName: string) =>
	({
		type: 'string',
		columnType: `varchar(${EVM_ADDRESS_LENGTH})`,
		fieldName,
	}) as const;

const timestampColumn = (fieldName: string) =>
	({ type: 'datetime', columnType: 'timestamptz(3)', fieldName }) as const;

const organizationColumn = (joinColumn: string, foreignKeyName: string) =>
	({
		entity: () => Organization,
		mapToPk: true,
		joinColumn,
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName,
	}) as const;

const UNSETTLED_CHANNEL = `"state" <> '${PaymentChannelState.CLOSED}'`;

const LEASE_COLUMNS = [
	'leaseId',
	'sandboxId',
	'machineId',
	'hostOrganizationId',
] as const;

const columnsAre = (columns: readonly string[], test: string) =>
	columns.map((column) => `"${column}" ${test}`).join(' and ');

// An escrow payment channel: the customer's funding wallet pays through
// cumulative vouchers either one sandbox lease's host (payout wallet) or, for
// one calendar month, Snapflow's platform services (the fee recipient). The
// relayer's in-flight claim and the last sequence it saw confirmed live here
// so a claim is never sent twice.
@Entity({ tableName: 'payment_channel' })
@Unique({
	name: 'UQ_payment_channel_channel',
	properties: ['chainId', 'contractAddress', 'channelId'],
})
@Unique({ name: 'UQ_payment_channel_lease', properties: ['leaseId'] })
@Unique({
	name: 'UQ_payment_channel_service_period',
	properties: [
		'chainId',
		'contractAddress',
		'customerOrganizationId',
		'servicePeriodStart',
	],
})
@Index({
	name: 'IDX_payment_channel_customer',
	properties: ['customerOrganizationId', 'openedAt', 'id'],
})
@Index({
	name: 'IDX_payment_channel_customer_address',
	properties: ['customerAddress'],
})
@Index({
	name: 'IDX_payment_channel_machine',
	properties: ['machineId', 'state'],
})
@Index({
	name: 'IDX_payment_channel_issue_due',
	expression: `create index "IDX_payment_channel_issue_due" on "payment_channel" ("nextIssueAt") where ${UNSETTLED_CHANNEL}`,
})
@Check({
	name: 'CHK_payment_channel_state',
	expression: `"state" in (${sqlValueList(PaymentChannelState)})`,
})
@Check({
	name: 'CHK_payment_channel_kind',
	expression: `("kind" = '${PaymentChannelKind.LEASE}' and ${columnsAre(LEASE_COLUMNS, 'is not null')} and "servicePeriodStart" is null)
		or ("kind" = '${PaymentChannelKind.PLATFORM_SERVICE}' and ${columnsAre(LEASE_COLUMNS, 'is null')} and "servicePeriodStart" is not null)`,
})
@Check({
	name: 'CHK_payment_channel_signing_mode',
	expression: `"signingMode" in (${sqlValueList(VoucherSigningMode)})`,
})
@Check({
	name: 'CHK_payment_channel_closed',
	expression: `("state" = '${PaymentChannelState.OPEN}') = ("closedAt" is null)`,
})
@Check({
	name: 'CHK_payment_channel_claim',
	expression: '("claimTransactionHash" is null) = ("claimSequence" is null)',
})
export class PaymentChannel {
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

	@Property({
		type: 'string',
		columnType: `varchar(${EVM_HASH_LENGTH})`,
		fieldName: 'channelId',
	})
	channelId: Hex;

	@Property({ type: 'string', columnType: 'varchar', fieldName: 'kind' })
	kind: PaymentChannelKind;

	@ManyToOne({
		entity: () => SandboxLease,
		mapToPk: true,
		joinColumn: 'leaseId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_payment_channel_lease',
	})
	leaseId: string | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'sandboxId',
		nullable: true,
	})
	sandboxId: string | null;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'machineId',
		nullable: true,
	})
	machineId: string | null;

	// The first instant of the UTC month a platform service channel bills.
	@Property({ ...timestampColumn('servicePeriodStart'), nullable: true })
	servicePeriodStart: Date | null;

	@ManyToOne(
		organizationColumn(
			'customerOrganizationId',
			'FK_payment_channel_customer_organization'
		)
	)
	customerOrganizationId: string;

	@ManyToOne({
		...organizationColumn(
			'hostOrganizationId',
			'FK_payment_channel_host_organization'
		),
		nullable: true,
	})
	hostOrganizationId: string | null;

	@Property(addressColumn('customerAddress'))
	customerAddress: Address;

	@Property(addressColumn('hostAddress'))
	hostAddress: Address;

	@Property({ type: 'string', columnType: 'varchar', fieldName: 'signingMode' })
	signingMode: VoucherSigningMode;

	@Property({ type: 'string', columnType: 'varchar', fieldName: 'state' })
	state: PaymentChannelState;

	@Property(timestampColumn('openedAt'))
	openedAt: Date;

	@Property({ ...timestampColumn('closedAt'), nullable: true })
	closedAt: Date | null;

	// Until when a signed voucher is known to cover everything the channel
	// owed; the funding policy treats a lease's sandbox as unfunded once its
	// channel falls behind.
	@Property(timestampColumn('coveredAt'))
	coveredAt: Date;

	@Property(timestampColumn('nextIssueAt'))
	nextIssueAt: Date;

	// Why the latest voucher is not signed, when signing it was refused.
	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'voucherError',
		nullable: true,
	})
	voucherError: string | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'claimedSequence',
	})
	claimedSequence: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'claimSequence',
		nullable: true,
	})
	claimSequence: number | null;

	@Property({
		type: 'string',
		columnType: `varchar(${EVM_HASH_LENGTH})`,
		fieldName: 'claimTransactionHash',
		nullable: true,
	})
	claimTransactionHash: Hash | null;

	@Property({ ...timestampColumn('claimAttemptedAt'), nullable: true })
	claimAttemptedAt: Date | null;

	@Property({
		type: 'text',
		columnType: 'text',
		fieldName: 'claimError',
		nullable: true,
	})
	claimError: string | null;

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
