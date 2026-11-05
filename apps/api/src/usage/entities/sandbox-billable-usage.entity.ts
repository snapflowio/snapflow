/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { DecimalType } from '@mikro-orm/core';
import {
	Check,
	Entity,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import {
	BillingEvidenceStatus,
	type BillingEvidenceStatus as BillingEvidenceStatusValue,
} from '../../billing/constants/billing.constants';
import { Machine } from '../../machine/entities/machine.entity';
import { SandboxLease } from '../../marketplace/entities/sandbox-lease.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxPlacement } from '../../sandbox/entities/sandbox-placement.entity';
import {
	INITIAL_RECONCILE_ATTEMPTS,
	INITIAL_USAGE_RECEIPT_COUNT,
	USAGE_ACCOUNTING_POLICY_VERSION,
	USAGE_COUNTER_SCALE,
	USAGE_MONEY_SCALE,
	USAGE_NUMERIC_PRECISION,
	USAGE_RESOURCE_SCALE,
	USAGE_ZERO_QUANTITY,
} from '../constants/usage-accounting.constants';

const quantityColumn = (fieldName: string) =>
	({
		type: DecimalType,
		columnType: `numeric(${USAGE_NUMERIC_PRECISION.QUANTITY},${USAGE_RESOURCE_SCALE})`,
		runtimeType: 'string',
		fieldName,
	}) as const;

const usageEvidenceStatuses = Object.values(BillingEvidenceStatus)
	.map((value) => `'${value}'`)
	.join(', ');

@Entity({ tableName: 'sandbox_billable_usage' })
@Index({
	name: 'IDX_sandbox_billable_usage_period',
	expression:
		'create unique index "IDX_sandbox_billable_usage_period" on "sandbox_billable_usage" ("usagePeriodId")',
})
@Index({
	name: 'IDX_sandbox_billable_usage_customer',
	properties: ['customerOrganizationId', 'endAt'],
})
@Index({
	name: 'IDX_sandbox_billable_usage_host',
	properties: ['hostOrganizationId', 'endAt'],
})
@Index({
	name: 'IDX_sandbox_billable_usage_evidence',
	properties: ['evidenceStatus', 'nextReconcileAt'],
})
@Check({
	name: 'CHK_sandbox_billable_usage_window',
	expression: '"endAt" >= "startAt"',
})
@Check({
	name: 'CHK_sandbox_billable_usage_generation',
	expression: '"assignmentGeneration" > 0 and "policyVersion" > 0',
})
@Check({
	name: 'CHK_sandbox_billable_usage_amounts',
	expression:
		'"durationMillis" > 0 and cpu >= 0 and "memoryGiB" >= 0 and "diskGiB" >= 0 and gpu >= 0 and "totalChargeMicroUsd" > 0 and "vcpuMillis" >= 0 and "memoryGibMillis" >= 0 and "gpuMillis" >= 0 and "runningDiskGibMillis" >= 0 and "stoppedDiskGibMillis" >= 0 and "hostChargeMicroUsd" + "markupChargeMicroUsd" = "totalChargeMicroUsd"',
})
@Check({
	name: 'CHK_sandbox_billable_usage_evidence_status',
	expression: `"evidenceStatus" in (${usageEvidenceStatuses})`,
})
export class SandboxBillableUsage {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'usagePeriodId',
	})
	usagePeriodId: string;

	@ManyToOne({
		entity: () => Sandbox,
		mapToPk: true,
		joinColumn: 'sandboxId',
		columnType: 'varchar',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_billable_usage_sandbox',
	})
	sandboxId: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'customerOrganizationId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_billable_usage_customer_organization',
	})
	customerOrganizationId: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'hostOrganizationId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_billable_usage_host_organization',
	})
	hostOrganizationId: string;

	@ManyToOne({
		entity: () => SandboxPlacement,
		mapToPk: true,
		joinColumn: 'placementId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_billable_usage_placement',
	})
	placementId: string;

	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_billable_usage_machine',
	})
	machineId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'assignmentGeneration',
	})
	assignmentGeneration: number;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'startAt',
	})
	startAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'endAt',
	})
	endAt: Date;

	@Property({
		type: DecimalType,
		columnType: `numeric(${USAGE_NUMERIC_PRECISION.DURATION},${USAGE_COUNTER_SCALE})`,
		runtimeType: 'string',
		fieldName: 'durationMillis',
	})
	durationMillis: string;

	@Property({
		type: DecimalType,
		columnType: `numeric(${USAGE_NUMERIC_PRECISION.RESOURCE},${USAGE_RESOURCE_SCALE})`,
		runtimeType: 'string',
	})
	cpu: string;

	@Property({
		type: DecimalType,
		columnType: `numeric(${USAGE_NUMERIC_PRECISION.RESOURCE},${USAGE_RESOURCE_SCALE})`,
		runtimeType: 'string',
		fieldName: 'memoryGiB',
	})
	memoryGiB: string;

	@Property({
		type: DecimalType,
		columnType: `numeric(${USAGE_NUMERIC_PRECISION.RESOURCE},${USAGE_RESOURCE_SCALE})`,
		runtimeType: 'string',
		fieldName: 'diskGiB',
	})
	diskGiB: string;

	@Property({
		type: DecimalType,
		columnType: `numeric(${USAGE_NUMERIC_PRECISION.RESOURCE},${USAGE_RESOURCE_SCALE})`,
		runtimeType: 'string',
	})
	gpu: string;

	@ManyToOne({
		entity: () => SandboxLease,
		mapToPk: true,
		joinColumn: 'leaseId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_billable_usage_lease',
	})
	leaseId: string;

	@Property(quantityColumn('vcpuMillis'))
	vcpuMillis: string;

	@Property(quantityColumn('memoryGibMillis'))
	memoryGibMillis: string;

	@Property(quantityColumn('gpuMillis'))
	gpuMillis: string;

	@Property(quantityColumn('runningDiskGibMillis'))
	runningDiskGibMillis: string;

	@Property(quantityColumn('stoppedDiskGibMillis'))
	stoppedDiskGibMillis: string;

	@Property({
		type: DecimalType,
		columnType: `numeric(${USAGE_NUMERIC_PRECISION.MONEY},${USAGE_MONEY_SCALE})`,
		runtimeType: 'string',
		fieldName: 'hostChargeMicroUsd',
	})
	hostChargeMicroUsd: string;

	@Property({
		type: DecimalType,
		columnType: `numeric(${USAGE_NUMERIC_PRECISION.MONEY},${USAGE_MONEY_SCALE})`,
		runtimeType: 'string',
		fieldName: 'markupChargeMicroUsd',
	})
	markupChargeMicroUsd: string;

	@Property({
		type: DecimalType,
		columnType: `numeric(${USAGE_NUMERIC_PRECISION.MONEY},${USAGE_MONEY_SCALE})`,
		runtimeType: 'string',
		fieldName: 'totalChargeMicroUsd',
	})
	totalChargeMicroUsd: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'policyVersion',
		default: USAGE_ACCOUNTING_POLICY_VERSION,
	})
	policyVersion = USAGE_ACCOUNTING_POLICY_VERSION;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'evidenceStatus',
		default: BillingEvidenceStatus.PENDING,
	})
	evidenceStatus: BillingEvidenceStatusValue = BillingEvidenceStatus.PENDING;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'corroboratedAt',
		nullable: true,
	})
	corroboratedAt: Date | null;

	@Property({
		type: DecimalType,
		columnType: `numeric(${USAGE_NUMERIC_PRECISION.DURATION},${USAGE_COUNTER_SCALE})`,
		runtimeType: 'string',
		fieldName: 'observedComputeMillis',
		default: USAGE_ZERO_QUANTITY,
	})
	observedComputeMillis = USAGE_ZERO_QUANTITY;

	@Property({
		type: DecimalType,
		columnType: `numeric(${USAGE_NUMERIC_PRECISION.DURATION},${USAGE_COUNTER_SCALE})`,
		runtimeType: 'string',
		fieldName: 'observedStorageMillis',
		default: USAGE_ZERO_QUANTITY,
	})
	observedStorageMillis = USAGE_ZERO_QUANTITY;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'receiptCount',
		default: INITIAL_USAGE_RECEIPT_COUNT,
	})
	receiptCount = INITIAL_USAGE_RECEIPT_COUNT;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'reconciliationReason',
		nullable: true,
	})
	reconciliationReason: string | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'reconciledAt',
		nullable: true,
	})
	reconciledAt: Date | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'reconcileAttempts',
		default: INITIAL_RECONCILE_ATTEMPTS,
	})
	reconcileAttempts = INITIAL_RECONCILE_ATTEMPTS;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'nextReconcileAt',
	})
	nextReconcileAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;
}
