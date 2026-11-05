/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Check,
	Entity,
	ManyToOne,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import { Organization } from '../../organization/entities/organization.entity';
import { COUNTRY_CODE_LENGTH } from '../constants/payments.constants';
import {
	PaymentAccountRequirementsStatus,
	PaymentAccountTaxInformationStatus,
	PaymentAccountTransfersStatus,
} from '../enums/payment-account-status.enum';

const booleanColumn = (fieldName: string) =>
	({ type: 'boolean', fieldName, default: false }) as const;

const statusColumn = (fieldName: string, initial: string) =>
	({
		type: 'string',
		columnType: 'varchar',
		fieldName,
		default: initial,
	}) as const;

@Entity({ tableName: 'payment_account' })
@Unique({
	name: 'UQ_payment_account_stripe_account',
	properties: ['stripeAccountId'],
})
@Check({
	name: 'CHK_payment_account_transfers_status',
	expression: `"transfersStatus" in (${sqlValueList(PaymentAccountTransfersStatus)})`,
})
@Check({
	name: 'CHK_payment_account_requirements_status',
	expression: `"requirementsStatus" in (${sqlValueList(PaymentAccountRequirementsStatus)})`,
})
@Check({
	name: 'CHK_payment_account_tax_information_status',
	expression: `"taxInformationStatus" in (${sqlValueList(PaymentAccountTaxInformationStatus)})`,
})
export class PaymentAccount {
	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		primary: true,
		joinColumn: 'organizationId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_payment_account_organization',
	})
	organizationId: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'stripeAccountId',
	})
	stripeAccountId: string;

	@Property({
		type: 'string',
		columnType: `varchar(${COUNTRY_CODE_LENGTH})`,
		fieldName: 'country',
		nullable: true,
	})
	country: string | null = null;

	@Property(booleanColumn('customerConfigured'))
	customerConfigured = false;

	@Property(booleanColumn('recipientRequested'))
	recipientRequested = false;

	@Property(
		statusColumn('transfersStatus', PaymentAccountTransfersStatus.INACTIVE)
	)
	transfersStatus: PaymentAccountTransfersStatus =
		PaymentAccountTransfersStatus.INACTIVE;

	@Property(
		statusColumn('requirementsStatus', PaymentAccountRequirementsStatus.NONE)
	)
	requirementsStatus: PaymentAccountRequirementsStatus =
		PaymentAccountRequirementsStatus.NONE;

	@Property(
		statusColumn(
			'taxInformationStatus',
			PaymentAccountTaxInformationStatus.MISSING
		)
	)
	taxInformationStatus: PaymentAccountTaxInformationStatus =
		PaymentAccountTaxInformationStatus.MISSING;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'payoutsBlockedReason',
		nullable: true,
	})
	payoutsBlockedReason: string | null = null;

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
