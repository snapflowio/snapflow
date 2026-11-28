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
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import {
	timestampColumn,
	uuidColumn,
	uuidPrimaryKey,
	varcharColumn,
} from '../../infra/database/utils/entity-columns.util';
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import { AbuseHostnameKind } from '../constants/abuse-report.constants';

@Entity({ tableName: 'abuse_hostname' })
@Unique({
	name: 'UQ_abuse_hostname_assignment',
	properties: ['hostname', 'sandboxId'],
})
@Index({ name: 'IDX_abuse_hostname_sandbox', properties: ['sandboxId'] })
@Check({
	name: 'CHK_abuse_hostname_kind',
	expression: `"kind" in (${sqlValueList(AbuseHostnameKind)})`,
})
export class AbuseHostname {
	[OptionalProps]?: 'id' | 'exposureId' | 'releasedAt';

	@PrimaryKey(uuidPrimaryKey)
	id: string;

	@Property(varcharColumn('hostname'))
	hostname: string;

	@Property(varcharColumn('kind'))
	kind: AbuseHostnameKind;

	@Property(varcharColumn('sandboxId'))
	sandboxId: string;

	@Property(uuidColumn('organizationId'))
	organizationId: string;

	@Property({ ...uuidColumn('exposureId'), nullable: true })
	exposureId: string | null = null;

	@Property(timestampColumn('assignedAt'))
	assignedAt: Date;

	@Property({ ...timestampColumn('releasedAt'), nullable: true })
	releasedAt: Date | null = null;
}
