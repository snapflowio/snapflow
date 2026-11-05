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
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import { Machine } from '../../sandbox/machine/entities/machine.entity';
import { VerificationReviewKind } from '../enums/verification-review-kind.enum';
import { VerificationReviewState } from '../enums/verification-review-state.enum';

@Entity({ tableName: 'verification_review' })
@Index({
	name: 'IDX_verification_review_queue',
	properties: ['state', 'openedAt'],
})
@Check({
	name: 'CHK_verification_review_kind',
	expression: `"kind" in (${sqlValueList(VerificationReviewKind)})`,
})
@Check({
	name: 'CHK_verification_review_state',
	expression: `"state" in (${sqlValueList(VerificationReviewState)})`,
})
@Check({
	name: 'CHK_verification_review_resolution',
	expression: `("state" = '${VerificationReviewState.OPEN}') = ("resolvedAt" is null)`,
})
export class VerificationReview {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_verification_review_machine',
	})
	machineId: string;

	@Property({ type: 'string', columnType: 'varchar', fieldName: 'kind' })
	kind: VerificationReviewKind;

	@Property({ type: 'uuid', columnType: 'uuid', fieldName: 'referenceId' })
	referenceId: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'state',
		default: VerificationReviewState.OPEN,
	})
	state: VerificationReviewState = VerificationReviewState.OPEN;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'openedAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	openedAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'resolvedAt',
		nullable: true,
	})
	resolvedAt: Date | null = null;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'resolvedBy',
		nullable: true,
	})
	resolvedBy: string | null = null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'resolutionReason',
		nullable: true,
	})
	resolutionReason: string | null = null;
}
