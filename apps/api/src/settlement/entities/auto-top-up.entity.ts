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
	ManyToOne,
	Property,
} from '@mikro-orm/decorators/legacy';
import type { Hash } from 'viem';
import { Organization } from '../../organization/entities/organization.entity';
import {
	amountColumn,
	createdAtColumn,
	hashColumn,
	integerColumn,
	textColumn,
	timestampColumn,
	updatedAtColumn,
} from '../utils/settlement-columns.util';

@Entity({ tableName: 'auto_top_up' })
@Check({
	name: 'CHK_auto_top_up_settings',
	expression:
		'"thresholdMicroUsd" > 0 and "amountMicroUsd" > "maxRelayFeeMicroUsd" and "maxRelayFeeMicroUsd" >= 0 and "timesPerDay" > 0',
})
export class AutoTopUp {
	[OptionalProps]?:
		| 'lastAttemptAt'
		| 'lastTransactionHash'
		| 'lastFailedAt'
		| 'lastError'
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
		foreignKeyName: 'FK_auto_top_up_organization',
	})
	organizationId: string;

	@Property({ type: 'boolean', fieldName: 'enabled' })
	enabled: boolean;

	@Property(amountColumn('amountMicroUsd'))
	amountMicroUsd: string;

	@Property(amountColumn('thresholdMicroUsd'))
	thresholdMicroUsd: string;

	@Property(integerColumn('timesPerDay'))
	timesPerDay: number;

	@Property(amountColumn('maxRelayFeeMicroUsd'))
	maxRelayFeeMicroUsd: string;

	@Property({ ...timestampColumn('lastAttemptAt'), nullable: true })
	lastAttemptAt: Date | null = null;

	@Property({ ...hashColumn('lastTransactionHash'), nullable: true })
	lastTransactionHash: Hash | null = null;

	@Property({ ...timestampColumn('lastFailedAt'), nullable: true })
	lastFailedAt: Date | null = null;

	@Property({ ...textColumn('lastError'), nullable: true })
	lastError: string | null = null;

	@Property(createdAtColumn)
	createdAt: Date;

	@Property(updatedAtColumn)
	updatedAt: Date;
}
