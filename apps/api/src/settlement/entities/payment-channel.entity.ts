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
import type { Address, Hex } from 'viem';
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import { Organization } from '../../organization/entities/organization.entity';
import { PaymentChannelKind } from '../enums/payment-channel-kind.enum';
import { VoucherLimit } from '../enums/voucher-limit.enum';
import { VoucherSigningMode } from '../enums/voucher-signing-mode.enum';
import {
	addressColumn,
	amountColumn,
	createdAtColumn,
	hashColumn,
	integerColumn,
	timestampColumn,
	updatedAtColumn,
	uuidPrimaryKey,
	varcharColumn,
} from '../utils/settlement-columns.util';

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

const SANDBOX_COLUMNS = ['machineId', 'hostOrganizationId'] as const;

const AMOUNT_COLUMNS = [
	'chargedMicroUsd',
	'issuedMicroUsd',
	'signedMicroUsd',
	'claimedMicroUsd',
	'refundedMicroUsd',
] as const;

const columnsAre = (columns: readonly string[], test: string) =>
	columns.map((column) => `"${column}" ${test}`).join(' and ');

@Entity({ tableName: 'payment_channel' })
@Unique({
	name: 'UQ_payment_channel_channel',
	properties: ['chainId', 'contractAddress', 'channelId'],
})
@Index({
	name: 'IDX_payment_channel_customer',
	properties: ['customerOrganizationId', 'createdAt', 'id'],
})
@Index({
	name: 'IDX_payment_channel_host',
	properties: ['hostOrganizationId', 'createdAt', 'id'],
})
@Index({
	name: 'IDX_payment_channel_customer_address',
	properties: ['chainId', 'contractAddress', 'customerAddress'],
})
@Index({
	name: 'IDX_payment_channel_host_address',
	properties: ['chainId', 'contractAddress', 'hostAddress'],
})
@Index({ name: 'IDX_payment_channel_machine', properties: ['machineId'] })
@Index({
	name: 'IDX_payment_channel_issue_due',
	expression:
		'create index "IDX_payment_channel_issue_due" on "payment_channel" ("nextIssueAt") where "nextIssueAt" is not null',
})
@Check({
	name: 'CHK_payment_channel_kind',
	expression: `("kind" = '${PaymentChannelKind.SANDBOX}' and ${columnsAre(SANDBOX_COLUMNS, 'is not null')})
		or ("kind" = '${PaymentChannelKind.PLATFORM}' and ${columnsAre(SANDBOX_COLUMNS, 'is null')})`,
})
@Check({
	name: 'CHK_payment_channel_signing_mode',
	expression: `"signingMode" in (${sqlValueList(VoucherSigningMode)})`,
})
@Check({
	name: 'CHK_payment_channel_voucher_error',
	expression: `"voucherError" is null or "voucherError" in (${sqlValueList(VoucherLimit)})`,
})
@Check({
	name: 'CHK_payment_channel_amounts',
	expression: `"feeBps" >= 0 and ${columnsAre(AMOUNT_COLUMNS, '>= 0')} and "signedMicroUsd" <= "issuedMicroUsd"`,
})
export class PaymentChannel {
	[OptionalProps]?: 'id' | 'createdAt' | 'updatedAt';

	@PrimaryKey(uuidPrimaryKey)
	id: string;

	@Property(integerColumn('chainId'))
	chainId: number;

	@Property(addressColumn('contractAddress'))
	contractAddress: Address;

	@Property(hashColumn('channelId'))
	channelId: Hex;

	@Property(varcharColumn('kind'))
	kind: PaymentChannelKind;

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

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'machineId',
		nullable: true,
	})
	machineId: string | null;

	@Property(addressColumn('customerAddress'))
	customerAddress: Address;

	@Property(addressColumn('hostAddress'))
	hostAddress: Address;

	@Property(addressColumn('feeReceiverAddress'))
	feeReceiverAddress: Address;

	@Property(integerColumn('feeBps'))
	feeBps: number;

	@Property(hashColumn('salt'))
	salt: Hex;

	@Property(varcharColumn('signingMode'))
	signingMode: VoucherSigningMode;

	@Property(amountColumn('chargedMicroUsd'))
	chargedMicroUsd: string;

	@Property(amountColumn('issuedMicroUsd'))
	issuedMicroUsd: string;

	@Property(amountColumn('signedMicroUsd'))
	signedMicroUsd: string;

	@Property(amountColumn('claimedMicroUsd'))
	claimedMicroUsd: string;

	@Property(amountColumn('refundedMicroUsd'))
	refundedMicroUsd: string;

	@Property(timestampColumn('coveredAt'))
	coveredAt: Date;

	@Property({ ...timestampColumn('nextIssueAt'), nullable: true })
	nextIssueAt: Date | null;

	@Property({ ...varcharColumn('voucherError'), nullable: true })
	voucherError: VoucherLimit | null;

	@Property({ ...timestampColumn('lastClaimedAt'), nullable: true })
	lastClaimedAt: Date | null;

	@Property(createdAtColumn)
	createdAt: Date;

	@Property(updatedAtColumn)
	updatedAt: Date;
}
