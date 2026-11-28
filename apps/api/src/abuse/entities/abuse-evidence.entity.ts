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
import {
	booleanColumn,
	createdAtColumn,
	jsonColumn,
	timestampColumn,
	uuidPrimaryKey,
	varcharColumn,
} from '../../infra/database/utils/entity-columns.util';
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import { AbuseEvidenceKind } from '../constants/abuse-report.constants';
import type { AbuseEvidencePayload } from '../utils/abuse-evidence.util';
import { AbuseCase } from './abuse-case.entity';

@Entity({ tableName: 'abuse_evidence' })
@Index({ name: 'IDX_abuse_evidence_case', properties: ['abuseCaseId'] })
@Index({ name: 'IDX_abuse_evidence_retain', properties: ['retainUntil'] })
@Check({
	name: 'CHK_abuse_evidence_kind',
	expression: `"kind" in (${sqlValueList(AbuseEvidenceKind)})`,
})
export class AbuseEvidence {
	[OptionalProps]?: 'id' | 'createdAt';

	@PrimaryKey(uuidPrimaryKey)
	id: string;

	@ManyToOne({
		entity: () => AbuseCase,
		mapToPk: true,
		joinColumn: 'abuseCaseId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_abuse_evidence_case',
	})
	abuseCaseId: string;

	@Property(varcharColumn('kind'))
	kind: AbuseEvidenceKind;

	@Property(booleanColumn('restricted'))
	restricted: boolean;

	@Property(jsonColumn('payload'))
	payload: AbuseEvidencePayload;

	@Property(timestampColumn('retainUntil'))
	retainUntil: Date;

	@Property(createdAtColumn)
	createdAt: Date;
}
