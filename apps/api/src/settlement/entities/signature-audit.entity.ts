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
} from '@mikro-orm/decorators/legacy';
import type { Hex } from 'viem';
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import { SignatureAuditKind } from '../enums/signature-audit-kind.enum';
import type { SignatureEvidence } from '../types/payment-channel.types';
import {
	createdAtColumn,
	hashColumn,
	timestampColumn,
	uuidPrimaryKey,
	varcharColumn,
} from '../utils/settlement-columns.util';
import { DelegatedSigner } from './delegated-signer.entity';
import { PaymentVoucher } from './payment-voucher.entity';

@Entity({ tableName: 'signature_audit' })
@Index({
	name: 'IDX_signature_audit_signer',
	properties: ['delegatedSignerId', 'signedAt'],
})
@Check({
	name: 'CHK_signature_audit_kind',
	expression: `"kind" in (${sqlValueList(SignatureAuditKind)})`,
})
export class SignatureAudit {
	[OptionalProps]?: 'id' | 'createdAt';

	@PrimaryKey(uuidPrimaryKey)
	id: string;

	@ManyToOne({
		entity: () => DelegatedSigner,
		mapToPk: true,
		joinColumn: 'delegatedSignerId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_signature_audit_delegated_signer',
	})
	delegatedSignerId: string;

	@Property(varcharColumn('kind'))
	kind: SignatureAuditKind;

	@Property(hashColumn('digest'))
	digest: Hex;

	@ManyToOne({
		entity: () => PaymentVoucher,
		mapToPk: true,
		joinColumn: 'voucherId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_signature_audit_voucher',
	})
	voucherId: string | null;

	@Property({ type: 'json', columnType: 'jsonb', fieldName: 'evidence' })
	evidence: SignatureEvidence;

	@Property(timestampColumn('signedAt'))
	signedAt: Date;

	@Property(createdAtColumn)
	createdAt: Date;
}
