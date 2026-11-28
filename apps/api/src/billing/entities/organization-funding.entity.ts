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
import { Organization } from '../../organization/entities/organization.entity';
import { RunwayWarning } from '../constants/funding.constants';

const timestampColumn = (fieldName: string) =>
	({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName,
		nullable: true,
	}) as const;

const runwayWarnings = Object.values(RunwayWarning)
	.map((warning) => `'${warning}'`)
	.join(', ');

@Entity({ tableName: 'organization_funding' })
@Check({
	name: 'CHK_organization_funding_runway_warning',
	expression: `"runwayWarning" is null or "runwayWarning" in (${runwayWarnings})`,
})
export class OrganizationFunding {
	[OptionalProps]?:
		| 'runwayWarning'
		| 'runwayWarnedAt'
		| 'computeStoppedAt'
		| 'archiveDeletionNoticeAt'
		| 'archivesDeletedAt'
		| 'updatedAt';

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		primary: true,
		joinColumn: 'organizationId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_organization_funding_organization',
	})
	organizationId: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'runwayWarning',
		nullable: true,
	})
	runwayWarning: RunwayWarning | null = null;

	@Property(timestampColumn('runwayWarnedAt'))
	runwayWarnedAt: Date | null = null;

	@Property(timestampColumn('computeStoppedAt'))
	computeStoppedAt: Date | null = null;

	@Property(timestampColumn('archiveDeletionNoticeAt'))
	archiveDeletionNoticeAt: Date | null = null;

	@Property(timestampColumn('archivesDeletedAt'))
	archivesDeletedAt: Date | null = null;

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
