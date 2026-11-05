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
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import {
	BILLING_EVIDENCE_SCHEMA_VERSION,
	type BillingEvidenceBundlePayload,
} from '../schemas/billing-evidence-bundle.schema';
import { BillingLineItem } from './billing-line-item.entity';

@Entity({ tableName: 'billing_evidence_bundle' })
@Index({
	name: 'UQ_billing_evidence_bundle_line',
	expression:
		'create unique index "UQ_billing_evidence_bundle_line" on "billing_evidence_bundle" ("lineItemId")',
})
@Index({
	name: 'UQ_billing_evidence_bundle_root',
	expression:
		'create unique index "UQ_billing_evidence_bundle_root" on "billing_evidence_bundle" (root)',
})
@Index({
	name: 'IDX_billing_evidence_bundle_created',
	properties: ['createdAt'],
})
@Check({
	name: 'CHK_billing_evidence_bundle_version',
	expression: `"schemaVersion" = ${BILLING_EVIDENCE_SCHEMA_VERSION}`,
})
export class BillingEvidenceBundle {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@ManyToOne({
		entity: () => BillingLineItem,
		mapToPk: true,
		joinColumn: 'lineItemId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_billing_evidence_bundle_line',
	})
	lineItemId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'schemaVersion',
	})
	schemaVersion: number;

	@Property({ type: 'string', columnType: 'varchar(16)' })
	kind: BillingEvidenceBundlePayload['kind'];

	@Property({ type: 'string', columnType: 'char(64)' })
	root: string;

	@Property({ type: 'json', columnType: 'jsonb' })
	payload: BillingEvidenceBundlePayload;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
	})
	createdAt: Date;
}
