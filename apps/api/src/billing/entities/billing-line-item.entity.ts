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
import { SandboxLease } from '../../marketplace/entities/sandbox-lease.entity';
import { Organization } from '../../organization/entities/organization.entity';
import {
	BILLING_COLUMN_LENGTH,
	BILLING_NUMERIC_PRECISION,
	BILLING_NUMERIC_SCALE,
	BillingBeneficiaryKind,
	type BillingBeneficiaryKind as BillingBeneficiaryKindValue,
	BillingChargeClass,
	type BillingChargeClass as BillingChargeClassValue,
	BillingEvidenceStatus,
	type BillingEvidenceStatus as BillingEvidenceStatusValue,
	BillingLineSourceType,
} from '../constants/billing.constants';
import type { BillingLineQuantities } from '../schemas/billing-line-quantities.schema';
import type { BillingLineConsumedQuantities } from '../types/billing-line.types';

const billingChargeClasses = Object.values(BillingChargeClass)
	.map((value) => `'${value}'`)
	.join(', ');

const billingBeneficiaryKinds = Object.values(BillingBeneficiaryKind)
	.map((value) => `'${value}'`)
	.join(', ');

@Entity({ tableName: 'billing_line_item' })
@Index({
	name: 'IDX_billing_line_source',
	expression:
		'create unique index "IDX_billing_line_source" on "billing_line_item" ("sourceType", "sourceId", "sourceVersion")',
})
@Index({
	name: 'IDX_billing_line_customer',
	properties: ['customerOrganizationId', 'serviceThrough'],
})
@Index({
	name: 'IDX_billing_line_beneficiary',
	properties: ['beneficiaryKind', 'beneficiaryReference', 'serviceThrough'],
})
@Index({
	name: 'IDX_billing_line_placement',
	properties: ['placementId', 'evidenceStatus'],
})
@Index({
	name: 'IDX_billing_line_eligibility',
	properties: ['evidenceStatus', 'serviceThrough'],
})
@Index({
	name: 'IDX_billing_line_machine_pending',
	expression: `create index "IDX_billing_line_machine_pending" on "billing_line_item" ("machineId") where "evidenceStatus" = '${BillingEvidenceStatus.PENDING}'`,
})
@Index({
	name: 'IDX_billing_line_machine_attestation',
	expression: `create index "IDX_billing_line_machine_attestation" on "billing_line_item" ("machineId", "reconciledAt") where "evidenceStatus" = '${BillingEvidenceStatus.CORROBORATED}' and "sourceType" = '${BillingLineSourceType.SANDBOX_USAGE_PERIOD}'`,
})
@Index({
	name: 'IDX_billing_line_host_state',
	properties: ['hostOrganizationId', 'evidenceStatus'],
})
@Index({
	name: 'IDX_billing_line_earnings_unreleased',
	expression:
		'create index "IDX_billing_line_earnings_unreleased" on "billing_line_item" ("hostOrganizationId") where "earningsReleasedAt" is null and "hostMicroUsd" > 0',
})
@Check({
	name: 'CHK_billing_line_lease',
	expression: `("chargeClass" = '${BillingChargeClass.NETWORK}' or "leaseId" is not null) and ("chargeClass" = '${BillingChargeClass.NETWORK}') = ("quantities" is null)`,
})
@Check({
	name: 'CHK_billing_line_window',
	expression: '"periodEnd" >= "periodStart"',
})
@Check({
	name: 'CHK_billing_line_gross',
	expression: '"grossMicroUsd" >= 0',
})
@Check({
	name: 'CHK_billing_line_split',
	expression: `"hostMicroUsd" >= 0 and "markupMicroUsd" >= 0 and ("hostMicroUsd" + "markupMicroUsd" = "grossMicroUsd" or ("chargeClass" = '${BillingChargeClass.NETWORK}' and "hostMicroUsd" = 0 and "markupMicroUsd" = 0))`,
})
@Check({
	name: 'CHK_billing_line_charge_class',
	expression: `"chargeClass" in (${billingChargeClasses})`,
})
@Check({
	name: 'CHK_billing_line_beneficiary_kind',
	expression: `"beneficiaryKind" in (${billingBeneficiaryKinds})`,
})
export class BillingLineItem {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'schemaVersion',
	})
	schemaVersion: number;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'sourceType',
	})
	sourceType: string;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'sourceId',
	})
	sourceId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'sourceVersion',
	})
	sourceVersion: number;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'chargeClass',
	})
	chargeClass: BillingChargeClassValue;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'customerOrganizationId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_billing_line_item_customer_organization',
	})
	customerOrganizationId: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'beneficiaryKind',
	})
	beneficiaryKind: BillingBeneficiaryKindValue;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'beneficiaryReference',
	})
	beneficiaryReference: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'hostOrganizationId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_billing_line_item_host_organization',
	})
	hostOrganizationId: string | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'sandboxId',
	})
	sandboxId: string;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'placementId',
	})
	placementId: string;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'machineId',
	})
	machineId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'assignmentGeneration',
	})
	assignmentGeneration: number;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'resourceSku',
	})
	resourceSku: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'periodStart',
	})
	periodStart: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'periodEnd',
	})
	periodEnd: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'serviceThrough',
	})
	serviceThrough: Date;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'consumedQuantities',
	})
	consumedQuantities: BillingLineConsumedQuantities;

	@ManyToOne({
		entity: () => SandboxLease,
		mapToPk: true,
		joinColumn: 'leaseId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_billing_line_item_lease',
	})
	leaseId: string | null;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'quantities',
		nullable: true,
	})
	quantities: BillingLineQuantities | null;

	@Property({
		type: DecimalType,
		columnType: `numeric(${BILLING_NUMERIC_PRECISION.MONEY},${BILLING_NUMERIC_SCALE.MONEY})`,
		runtimeType: 'string',
		fieldName: 'grossMicroUsd',
	})
	grossMicroUsd: string;

	@Property({
		type: DecimalType,
		columnType: `numeric(${BILLING_NUMERIC_PRECISION.MONEY},${BILLING_NUMERIC_SCALE.MONEY})`,
		runtimeType: 'string',
		fieldName: 'hostMicroUsd',
	})
	hostMicroUsd: string;

	@Property({
		type: DecimalType,
		columnType: `numeric(${BILLING_NUMERIC_PRECISION.MONEY},${BILLING_NUMERIC_SCALE.MONEY})`,
		runtimeType: 'string',
		fieldName: 'markupMicroUsd',
	})
	markupMicroUsd: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'evidenceStatus',
	})
	evidenceStatus: BillingEvidenceStatusValue;

	@Property({
		type: 'string',
		columnType: `varchar(${BILLING_COLUMN_LENGTH.EVIDENCE_DIGEST})`,
		fieldName: 'contentDigest',
	})
	contentDigest: string;

	@Property({
		type: 'string',
		columnType: 'text',
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
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'earningsReleasedAt',
		nullable: true,
	})
	earningsReleasedAt: Date | null = null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
	})
	createdAt: Date;
}
