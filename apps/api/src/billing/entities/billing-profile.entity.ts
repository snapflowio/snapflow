/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { OptionalProps } from '@mikro-orm/core';
import { Entity, ManyToOne, Property } from '@mikro-orm/decorators/legacy';
import { Organization } from '../../organization/entities/organization.entity';
import { BILLING_PROFILE_LIMITS } from '../constants/billing-receipt.constants';

const COUNTRY_CODE_LENGTH = 2;

const textColumn = (fieldName: string, maxLength: number) =>
	({
		type: 'string',
		columnType: `varchar(${maxLength})`,
		fieldName,
	}) as const;

const optionalTextColumn = (fieldName: string, maxLength: number) =>
	({ ...textColumn(fieldName, maxLength), nullable: true }) as const;

const timestampColumn = (fieldName: string) =>
	({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName,
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	}) as const;

@Entity({ tableName: 'billing_profile' })
export class BillingProfile {
	[OptionalProps]?:
		| 'addressLine2'
		| 'region'
		| 'postalCode'
		| 'taxId'
		| 'createdAt'
		| 'updatedAt';

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		primary: true,
		joinColumn: 'organizationId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_billing_profile_organization',
	})
	organizationId: string;

	@Property(textColumn('legalName', BILLING_PROFILE_LIMITS.LEGAL_NAME))
	legalName: string;

	@Property(textColumn('addressLine1', BILLING_PROFILE_LIMITS.ADDRESS_LINE))
	addressLine1: string;

	@Property(
		optionalTextColumn('addressLine2', BILLING_PROFILE_LIMITS.ADDRESS_LINE)
	)
	addressLine2: string | null = null;

	@Property(textColumn('city', BILLING_PROFILE_LIMITS.CITY))
	city: string;

	@Property(optionalTextColumn('region', BILLING_PROFILE_LIMITS.REGION))
	region: string | null = null;

	@Property(
		optionalTextColumn('postalCode', BILLING_PROFILE_LIMITS.POSTAL_CODE)
	)
	postalCode: string | null = null;

	@Property({
		type: 'string',
		columnType: `char(${COUNTRY_CODE_LENGTH})`,
		fieldName: 'country',
	})
	country: string;

	@Property(optionalTextColumn('taxId', BILLING_PROFILE_LIMITS.TAX_ID))
	taxId: string | null = null;

	@Property(timestampColumn('createdAt'))
	createdAt: Date;

	@Property({
		...timestampColumn('updatedAt'),
		onUpdate: () => new Date(),
	})
	updatedAt: Date;
}
