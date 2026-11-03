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
	OneToOne,
	Property,
} from '@mikro-orm/decorators/legacy';
import { NETWORKING_LIMITS } from '../constants/networking.constants';
import { Exposure } from './exposure.entity';

@Entity({ tableName: 'sandbox_exposure_reconciliation' })
@Check({
	name: 'CHK_exposure_reconciliation_generation',
	expression: '"requestedGeneration" > 0',
})
@Check({
	name: 'CHK_exposure_reconciliation_attempt',
	expression: '"attempt" >= 0',
})
@Check({
	name: 'CHK_exposure_reconciliation_claim',
	expression: '("claimToken" is null) = ("claimExpiresAt" is null)',
})
@Index({
	name: 'IDX_exposure_reconciliation_available',
	properties: ['availableAt'],
})
export class ExposureReconciliation {
	@OneToOne({
		entity: () => Exposure,
		mapToPk: true,
		primary: true,
		joinColumn: 'exposureId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_exposure_reconciliation_exposure',
	})
	exposureId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'requestedGeneration',
	})
	requestedGeneration: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		default: 0,
	})
	attempt = 0;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'availableAt',
		defaultRaw: 'current_timestamp',
	})
	availableAt: Date;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'claimToken',
		nullable: true,
	})
	claimToken: string | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'claimExpiresAt',
		nullable: true,
	})
	claimExpiresAt: Date | null;

	@Property({
		type: 'string',
		columnType: `varchar(${NETWORKING_LIMITS.maximumErrorLength})`,
		fieldName: 'lastError',
		nullable: true,
	})
	lastError: string | null;

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
