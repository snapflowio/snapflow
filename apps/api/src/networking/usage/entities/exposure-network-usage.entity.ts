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
	Unique,
} from '@mikro-orm/decorators/legacy';
import { Organization } from '../../../organization/entities/organization.entity';
import { SandboxPlacement } from '../../../sandbox/entities/sandbox-placement.entity';
import { Machine } from '../../../sandbox/machine/entities/machine.entity';
import { type NetworkProtocol } from '../../constants/networking.constants';
import { NETWORKING_DATABASE_CHECK } from '../../constants/networking-database-check.constants';
import { Edge } from '../../entities/edge.entity';
import { EdgeUsageCheckpoint } from '../../entities/edge-usage-checkpoint.entity';
import { Exposure } from '../../entities/exposure.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import {
	NETWORK_USAGE_NUMERIC_PRECISION,
	NETWORK_USAGE_NUMERIC_SCALE,
} from '../constants/network-usage.constants';
import { NetworkUsagePeriod } from './network-usage-period.entity';

const counterColumn = (fieldName: string) =>
	({
		type: DecimalType,
		columnType: `numeric(${NETWORK_USAGE_NUMERIC_PRECISION},${NETWORK_USAGE_NUMERIC_SCALE})`,
		runtimeType: 'string',
		fieldName,
	}) as const;

@Entity({ tableName: 'exposure_network_usage' })
@Check({
	name: 'CHK_exposure_network_usage_assignment',
	expression: '"assignmentGeneration" > 0',
})
@Check({
	name: 'CHK_exposure_network_usage_protocol',
	expression: NETWORKING_DATABASE_CHECK.backendProtocol,
})
@Check({
	name: 'CHK_exposure_network_usage_window',
	expression: '"intervalEndedAt" > "intervalStartedAt"',
})
@Check({
	name: 'CHK_exposure_network_usage_counters',
	expression:
		'"edgeBytesIn" >= 0 and "edgeBytesOut" >= 0 and "edgePacketsIn" >= 0 and "edgePacketsOut" >= 0',
})
@Unique({
	name: 'UQ_exposure_network_usage_edge_sample',
	properties: ['edgeCheckpointId', 'backendId'],
})
@Index({
	name: 'IDX_exposure_network_usage_unrated',
	expression:
		'create index "IDX_exposure_network_usage_unrated" on "exposure_network_usage" ("createdAt") where "periodId" is null',
})
@Index({
	name: 'IDX_exposure_network_usage_placement',
	properties: ['placementId', 'createdAt'],
})
@Index({
	name: 'IDX_exposure_network_usage_period',
	properties: ['periodId'],
})
export class ExposureNetworkUsage {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@ManyToOne({
		entity: () => EdgeUsageCheckpoint,
		mapToPk: true,
		joinColumn: 'edgeCheckpointId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_exposure_network_usage_checkpoint',
	})
	edgeCheckpointId: string;

	@ManyToOne({
		entity: () => ExposureBackend,
		mapToPk: true,
		joinColumn: 'backendId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_exposure_network_usage_backend',
	})
	backendId: string;

	@ManyToOne({
		entity: () => Exposure,
		mapToPk: true,
		joinColumn: 'exposureId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_exposure_network_usage_exposure',
	})
	exposureId: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'organizationId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_exposure_network_usage_organization',
	})
	organizationId: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'sandboxId',
	})
	sandboxId: string;

	@ManyToOne({
		entity: () => SandboxPlacement,
		mapToPk: true,
		joinColumn: 'placementId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_exposure_network_usage_placement',
	})
	placementId: string;

	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_exposure_network_usage_machine',
	})
	machineId: string;

	@ManyToOne({
		entity: () => Edge,
		mapToPk: true,
		joinColumn: 'edgeId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_exposure_network_usage_edge',
	})
	edgeId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'assignmentGeneration',
	})
	assignmentGeneration: number;

	@Property({
		type: 'string',
		columnType: 'varchar',
	})
	protocol: NetworkProtocol;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'intervalStartedAt',
	})
	intervalStartedAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'intervalEndedAt',
	})
	intervalEndedAt: Date;

	@Property(counterColumn('edgeBytesIn'))
	edgeBytesIn: string;

	@Property(counterColumn('edgeBytesOut'))
	edgeBytesOut: string;

	@Property(counterColumn('edgePacketsIn'))
	edgePacketsIn: string;

	@Property(counterColumn('edgePacketsOut'))
	edgePacketsOut: string;

	@Property({
		type: 'boolean',
		columnType: 'boolean',
	})
	billable: boolean;

	@ManyToOne({
		entity: () => NetworkUsagePeriod,
		mapToPk: true,
		joinColumn: 'periodId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_exposure_network_usage_period',
	})
	periodId: string | null = null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;
}
