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
	integerColumn,
	timestampColumn,
	uuidColumn,
	uuidPrimaryKey,
	varcharColumn,
} from '../../infra/database/utils/entity-columns.util';
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import {
	ConnectionWorkloadKind,
	IspComplaintProtocol,
} from '../constants/isp-complaint.constants';

@Entity({ tableName: 'sandbox_connection_record' })
@Unique({
	name: 'UQ_sandbox_connection_record_flow',
	properties: [
		'workloadId',
		'destinationAddress',
		'destinationPort',
		'protocol',
		'bucketStart',
	],
})
@Index({
	name: 'IDX_sandbox_connection_record_destination',
	properties: ['destinationAddress', 'bucketStart'],
})
@Index({
	name: 'IDX_sandbox_connection_record_bucket',
	properties: ['bucketStart'],
})
@Check({
	name: 'CHK_sandbox_connection_record_protocol',
	expression: `"protocol" in (${sqlValueList(IspComplaintProtocol)})`,
})
@Check({
	name: 'CHK_sandbox_connection_record_workload_kind',
	expression: `"workloadKind" in (${sqlValueList(ConnectionWorkloadKind)})`,
})
export class SandboxConnectionRecord {
	[OptionalProps]?: 'id';

	@PrimaryKey(uuidPrimaryKey)
	id: string;

	@Property(varcharColumn('workloadId'))
	workloadId: string;

	@Property(varcharColumn('workloadKind'))
	workloadKind: ConnectionWorkloadKind;

	@Property(uuidColumn('organizationId'))
	organizationId: string;

	@Property(uuidColumn('machineId'))
	machineId: string;

	@Property(varcharColumn('destinationAddress'))
	destinationAddress: string;

	@Property(integerColumn('destinationPort'))
	destinationPort: number;

	@Property(varcharColumn('protocol'))
	protocol: IspComplaintProtocol;

	@Property(timestampColumn('bucketStart'))
	bucketStart: Date;

	@Property(timestampColumn('firstSeenAt'))
	firstSeenAt: Date;

	@Property(timestampColumn('lastSeenAt'))
	lastSeenAt: Date;
}
