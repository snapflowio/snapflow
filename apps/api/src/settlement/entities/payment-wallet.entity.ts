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
	ManyToOne,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import type { Address } from 'viem';
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import { Organization } from '../../organization/entities/organization.entity';
import { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';
import { SanctionsStatus } from '../enums/sanctions-status.enum';

const EVM_ADDRESS_LENGTH = 42;

@Entity({ tableName: 'payment_wallet' })
@Unique({
	name: 'UQ_payment_wallet_organization_purpose',
	properties: ['organizationId', 'purpose'],
})
@Unique({
	name: 'UQ_payment_wallet_purpose_address',
	properties: ['purpose', 'address'],
})
@Check({
	name: 'CHK_payment_wallet_purpose',
	expression: `"purpose" in (${sqlValueList(PaymentWalletPurpose)})`,
})
@Check({
	name: 'CHK_payment_wallet_sanctions_status',
	expression: `"sanctionsStatus" in (${sqlValueList(SanctionsStatus)})`,
})
export class PaymentWallet {
	[OptionalProps]?: 'id' | 'createdAt' | 'updatedAt';

	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'organizationId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_payment_wallet_organization',
	})
	organizationId: string;

	@Property({ type: 'string', columnType: 'varchar', fieldName: 'purpose' })
	purpose: PaymentWalletPurpose;

	// Stored in EIP-55 checksum form so equal addresses compare equal.
	@Property({
		type: 'string',
		columnType: `varchar(${EVM_ADDRESS_LENGTH})`,
		fieldName: 'address',
	})
	address: Address;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'verifiedAt',
	})
	verifiedAt: Date;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'sanctionsStatus',
	})
	sanctionsStatus: SanctionsStatus;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'sanctionsCheckedAt',
		nullable: true,
	})
	sanctionsCheckedAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;

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
