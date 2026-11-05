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
} from '@mikro-orm/decorators/legacy';
import { Organization } from '../../organization/entities/organization.entity';
import { PAYMENTS_INITIAL_VERSION } from '../constants/payments.constants';
import { PaymentMethod } from './payment-method.entity';

const integerColumn = (fieldName: string) =>
	({ type: 'integer', columnType: 'integer', fieldName }) as const;

@Entity({ tableName: 'auto_top_up_policy' })
@Check({
	name: 'CHK_auto_top_up_policy_amounts',
	expression: '"amountCents" > 0 and "thresholdCents" >= 0',
})
@Check({
	name: 'CHK_auto_top_up_policy_failures',
	expression: '"consecutiveFailures" >= 0',
})
export class AutoTopUpPolicy {
	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		primary: true,
		joinColumn: 'organizationId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_auto_top_up_policy_organization',
	})
	organizationId: string;

	@Property({ type: 'boolean', fieldName: 'enabled' })
	enabled: boolean;

	@Property(integerColumn('thresholdCents'))
	thresholdCents: number;

	@Property(integerColumn('amountCents'))
	amountCents: number;

	@ManyToOne({
		entity: () => PaymentMethod,
		mapToPk: true,
		joinColumn: 'paymentMethodId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_auto_top_up_policy_payment_method',
	})
	paymentMethodId: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'suspendedReason',
		nullable: true,
	})
	suspendedReason: string | null = null;

	@Property({ ...integerColumn('consecutiveFailures'), default: 0 })
	consecutiveFailures = 0;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'lastAttemptAt',
		nullable: true,
	})
	lastAttemptAt: Date | null = null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'consentedAt',
	})
	consentedAt: Date;

	@Property({ type: 'uuid', columnType: 'uuid', fieldName: 'consentedBy' })
	consentedBy: string;

	@Property({
		...integerColumn('version'),
		version: true,
		default: PAYMENTS_INITIAL_VERSION,
	})
	version = PAYMENTS_INITIAL_VERSION;
}
