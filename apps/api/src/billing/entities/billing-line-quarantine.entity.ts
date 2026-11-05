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
	Index,
	ManyToOne,
	Property,
} from '@mikro-orm/decorators/legacy';
import { BILLING_COLUMN_LENGTH } from '../constants/billing.constants';
import {
	BILLING_AUDIT_LIMITS,
	BillingAuditFailure,
	type BillingAuditFailure as BillingAuditFailureValue,
	BillingAuditFaultDomain,
	type BillingAuditFaultDomain as BillingAuditFaultDomainValue,
} from '../constants/billing-audit.constants';
import { BillingLineItem } from './billing-line-item.entity';

const failureCodes = Object.values(BillingAuditFailure)
	.map((value) => `'${value}'`)
	.join(', ');
const faultDomains = Object.values(BillingAuditFaultDomain)
	.map((value) => `'${value}'`)
	.join(', ');

@Entity({ tableName: 'billing_line_quarantine' })
@Index({
	name: 'IDX_billing_line_quarantine_machine',
	properties: ['machineId', 'quarantinedAt'],
})
@Check({
	name: 'CHK_billing_line_quarantine_failure',
	expression: `"failureCode" in (${failureCodes})`,
})
@Check({
	name: 'CHK_billing_line_quarantine_fault_domain',
	expression: `"faultDomain" in (${faultDomains})`,
})
export class BillingLineQuarantine {
	@ManyToOne({
		entity: () => BillingLineItem,
		mapToPk: true,
		primary: true,
		joinColumn: 'lineItemId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_billing_line_quarantine_line',
	})
	lineItemId: string;

	@Property({ type: 'uuid', columnType: 'uuid', fieldName: 'machineId' })
	machineId: string;

	@Property({
		type: 'string',
		columnType: `varchar(${BILLING_AUDIT_LIMITS.FAILURE_CODE})`,
		fieldName: 'failureCode',
	})
	failureCode: BillingAuditFailureValue;

	@Property({
		type: 'string',
		columnType: `varchar(${BILLING_AUDIT_LIMITS.FAULT_DOMAIN})`,
		fieldName: 'faultDomain',
	})
	faultDomain: BillingAuditFaultDomainValue;

	@Property({
		type: 'string',
		columnType: `varchar(${BILLING_COLUMN_LENGTH.EVIDENCE_DIGEST})`,
		fieldName: 'evidenceRoot',
		nullable: true,
	})
	evidenceRoot: string | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'auditPolicyVersion',
	})
	auditPolicyVersion: number;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'quarantinedAt',
	})
	quarantinedAt: Date;
}
