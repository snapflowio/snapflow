/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BigIntType } from '@mikro-orm/core';
import {
	Check,
	Entity,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import { SandboxPlacement } from '../../../sandbox/instance/entities/sandbox-placement.entity';
import {
	ACTIVE_BACKEND_STATES,
	EXPOSURE_BACKEND_STATE,
	type ExposureBackendState,
} from '../constants/exposure.constants';
import {
	NETWORKING_LIMITS,
	type NetworkProtocol,
} from '../constants/networking.constants';
import { NETWORKING_DATABASE_CHECK } from '../constants/networking-database-check.constants';
import { Edge } from './edge.entity';
import { Exposure } from './exposure.entity';
import { MachineEdgeBinding } from './machine-edge-binding.entity';

const activeBackendStates = ACTIVE_BACKEND_STATES.map(
	(state) => `'${state}'`
).join(', ');

@Entity({ tableName: 'sandbox_exposure_backend' })
@Check({
	name: 'CHK_exposure_backend_exposure_generation',
	expression: '"exposureGeneration" > 0',
})
@Check({
	name: 'CHK_exposure_backend_assignment_generation',
	expression: '"assignmentGeneration" > 0',
})
@Check({
	name: 'CHK_exposure_backend_machine_session_generation',
	expression: '"machineSessionGeneration" > 0',
})
@Check({
	name: 'CHK_exposure_backend_binding_revision',
	expression: '"bindingRevision" > 0',
})
@Check({
	name: 'CHK_exposure_backend_target_revision',
	expression: '"targetRevision" > 0',
})
@Check({
	name: 'CHK_exposure_backend_protocol',
	expression: NETWORKING_DATABASE_CHECK.backendProtocol,
})
@Check({
	name: 'CHK_exposure_backend_state',
	expression: NETWORKING_DATABASE_CHECK.backendState,
})
@Check({
	name: 'CHK_exposure_backend_cutover',
	expression: NETWORKING_DATABASE_CHECK.backendCutover,
})
@Check({
	name: 'CHK_exposure_backend_target_port',
	expression: `"targetPort" >= ${NETWORKING_LIMITS.minimumPort} and "targetPort" <= ${NETWORKING_LIMITS.maximumPort}`,
})
@Check({
	name: 'CHK_exposure_backend_public_port',
	expression: `"publicPort" is null or ("publicPort" >= ${NETWORKING_LIMITS.minimumPort} and "publicPort" <= ${NETWORKING_LIMITS.maximumPort})`,
})
@Index({
	name: 'UQ_exposure_backend_live_edge',
	expression: `create unique index "UQ_exposure_backend_live_edge" on "sandbox_exposure_backend" ("exposureId", "edgeId") where "state" in (${activeBackendStates})`,
})
@Index({
	name: 'UQ_exposure_backend_live_listener',
	expression: `create unique index "UQ_exposure_backend_live_listener" on "sandbox_exposure_backend" ("edgeId", "protocol", "publicPort") where "publicPort" is not null and "state" in (${activeBackendStates})`,
})
@Index({
	name: 'IDX_exposure_backend_placement_state',
	expression:
		'create index "IDX_exposure_backend_placement_state" on "sandbox_exposure_backend" ("placementId", "state")',
})
@Index({
	name: 'IDX_exposure_backend_lease',
	properties: ['state', 'leaseExpiresAt'],
})
@Index({
	name: 'IDX_exposure_backend_edge_live_lease',
	expression: `create index "IDX_exposure_backend_edge_live_lease" on "sandbox_exposure_backend" ("edgeId", "leaseExpiresAt") where "state" in (${activeBackendStates})`,
})
export class ExposureBackend {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@ManyToOne({
		entity: () => Exposure,
		mapToPk: true,
		joinColumn: 'exposureId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_exposure_backend_exposure',
	})
	exposureId: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'sandboxId',
	})
	sandboxId: string;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'machineId',
	})
	machineId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'assignmentGeneration',
	})
	assignmentGeneration: number;

	@ManyToOne({
		entity: () => SandboxPlacement,
		mapToPk: true,
		joinColumns: [
			'placementId',
			'sandboxId',
			'machineId',
			'assignmentGeneration',
		],
		referencedColumnNames: [
			'id',
			'sandboxId',
			'machineId',
			'assignmentGeneration',
		],
		ownColumns: ['placementId'],
		columnTypes: ['uuid', 'varchar', 'uuid', 'integer'],
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_exposure_backend_placement_fence',
	})
	placementId: string;

	@ManyToOne({
		entity: () => Edge,
		mapToPk: true,
		joinColumn: 'edgeId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_exposure_backend_edge',
	})
	edgeId: string;

	@ManyToOne({
		entity: () => MachineEdgeBinding,
		mapToPk: true,
		joinColumn: 'bindingId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_exposure_backend_binding',
	})
	bindingId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'exposureGeneration',
	})
	exposureGeneration: number;

	@Property({
		type: 'string',
		columnType: `char(${NETWORKING_LIMITS.sha256HexLength})`,
		fieldName: 'placementFencingTokenHash',
	})
	placementFencingTokenHash: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'machineSessionGeneration',
	})
	machineSessionGeneration: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'bindingRevision',
	})
	bindingRevision: number;

	@Property({
		type: 'string',
		columnType: `char(${NETWORKING_LIMITS.sha256HexLength})`,
		fieldName: 'bindingDigest',
	})
	bindingDigest: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'targetRevision',
		default: 1,
	})
	targetRevision = 1;

	@Property({
		type: 'string',
		columnType: `char(${NETWORKING_LIMITS.sha256HexLength})`,
		fieldName: 'targetDigest',
	})
	targetDigest: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
	})
	protocol: NetworkProtocol;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'targetPort',
	})
	targetPort: number;

	@Property({
		type: 'string',
		columnType: `varchar(${NETWORKING_LIMITS.maximumHostnameLength})`,
		fieldName: 'publicHost',
	})
	publicHost: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'publicPort',
		nullable: true,
	})
	publicPort: number | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		default: EXPOSURE_BACKEND_STATE.PENDING,
	})
	state: ExposureBackendState = EXPOSURE_BACKEND_STATE.PENDING;

	@Property({
		type: new BigIntType('string'),
		columnType: 'bigint',
		fieldName: 'routeTableVersion',
	})
	routeTableVersion: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'leaseExpiresAt',
	})
	leaseExpiresAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'edgeAcknowledgedAt',
		nullable: true,
	})
	edgeAcknowledgedAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'machineAcknowledgedAt',
		nullable: true,
	})
	machineAcknowledgedAt: Date | null;

	@Property({
		type: 'string',
		columnType: `varchar(${NETWORKING_LIMITS.maximumHostnameLength})`,
		fieldName: 'dnsTargetHost',
		nullable: true,
	})
	dnsTargetHost: string | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'dnsActivatedAt',
		nullable: true,
	})
	dnsActivatedAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'cutoverStartedAt',
		nullable: true,
	})
	cutoverStartedAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'cutoverVerifiedAt',
		nullable: true,
	})
	cutoverVerifiedAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'activatedAt',
		nullable: true,
	})
	activatedAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'drainingAt',
		nullable: true,
	})
	drainingAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'drainDeadline',
		nullable: true,
	})
	drainDeadline: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'releasedAt',
		nullable: true,
	})
	releasedAt: Date | null;

	@Property({
		type: 'string',
		columnType: `varchar(${NETWORKING_LIMITS.maximumErrorLength})`,
		fieldName: 'failureReason',
		nullable: true,
	})
	failureReason: string | null;

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
