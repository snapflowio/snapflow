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
import { Machine } from '../../machine/entities/machine.entity';
import {
	LIVE_BINDING_STATES,
	MACHINE_EDGE_BINDING_DESIRED_STATE,
	MACHINE_EDGE_BINDING_STATE,
	type MachineEdgeBindingDesiredState,
	type MachineEdgeBindingState,
	type TunnelCarrier,
} from '../constants/machine-tunnel.constants';
import { NETWORKING_LIMITS } from '../constants/networking.constants';
import { NETWORKING_DATABASE_CHECK } from '../constants/networking-database-check.constants';
import { Edge } from './edge.entity';

const liveBindingStates = LIVE_BINDING_STATES.map((state) => `'${state}'`).join(
	', '
);

@Entity({ tableName: 'machine_edge_binding' })
@Check({
	name: 'CHK_machine_edge_binding_revision',
	expression: '"revision" > 0',
})
@Check({
	name: 'CHK_machine_edge_binding_target_revision',
	expression: '"targetRevision" > 0',
})
@Check({
	name: 'CHK_machine_edge_binding_session_generation',
	expression: '"machineSessionGeneration" > 0',
})
@Check({
	name: 'CHK_machine_edge_binding_desired_state',
	expression: NETWORKING_DATABASE_CHECK.bindingDesiredState,
})
@Check({
	name: 'CHK_machine_edge_binding_observed_state',
	expression: NETWORKING_DATABASE_CHECK.bindingObservedState,
})
@Check({
	name: 'CHK_machine_edge_binding_rtt',
	expression:
		'"observedRttMilliseconds" is null or "observedRttMilliseconds"::numeric >= 0',
})
@Check({
	name: 'CHK_machine_edge_binding_loss',
	expression:
		'"observedLossRatio" is null or ("observedLossRatio"::numeric >= 0 and "observedLossRatio"::numeric <= 1)',
})
@Check({
	name: 'CHK_machine_edge_binding_carrier',
	expression: NETWORKING_DATABASE_CHECK.bindingCarrier,
})
@Index({
	name: 'UQ_machine_edge_binding_live',
	expression: `create unique index "UQ_machine_edge_binding_live" on "machine_edge_binding" ("machineId", "edgeId") where "observedState" in (${liveBindingStates})`,
})
@Index({
	name: 'IDX_machine_edge_binding_edge_expiry',
	properties: ['edgeId', 'leaseExpiresAt'],
})
@Index({
	name: 'IDX_machine_edge_binding_machine_state',
	properties: ['machineId', 'observedState'],
})
@Index({
	name: 'UQ_machine_edge_binding_backend_fence',
	expression:
		'create unique index "UQ_machine_edge_binding_backend_fence" on "machine_edge_binding" ("id", "machineId", "edgeId", "machineSessionGeneration", "revision", "digest")',
})
export class MachineEdgeBinding {
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
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_edge_binding_machine',
	})
	machineId: string;

	@ManyToOne({
		entity: () => Edge,
		mapToPk: true,
		joinColumn: 'edgeId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_edge_binding_edge',
	})
	edgeId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'machineSessionGeneration',
	})
	machineSessionGeneration: number;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'desiredState',
		default: MACHINE_EDGE_BINDING_DESIRED_STATE.ACTIVE,
	})
	desiredState: MachineEdgeBindingDesiredState =
		MACHINE_EDGE_BINDING_DESIRED_STATE.ACTIVE;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'observedState',
		default: MACHINE_EDGE_BINDING_STATE.PENDING,
	})
	observedState: MachineEdgeBindingState = MACHINE_EDGE_BINDING_STATE.PENDING;

	@Property({
		type: 'integer',
		columnType: 'integer',
		default: 1,
	})
	revision = 1;

	@Property({
		type: 'string',
		columnType: `char(${NETWORKING_LIMITS.sha256HexLength})`,
	})
	digest: string;

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
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'leaseExpiresAt',
	})
	leaseExpiresAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'lastAcknowledgedAt',
		nullable: true,
	})
	lastAcknowledgedAt: Date | null;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'activeConnectionId',
		nullable: true,
	})
	activeConnectionId: string | null;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'replacementConnectionId',
		nullable: true,
	})
	replacementConnectionId: string | null;

	@Property({
		type: 'double',
		columnType: 'double precision',
		fieldName: 'observedRttMilliseconds',
		nullable: true,
	})
	observedRttMilliseconds: number | null;

	@Property({
		type: 'double',
		columnType: 'double precision',
		fieldName: 'observedLossRatio',
		nullable: true,
	})
	observedLossRatio: number | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'observedCarrier',
		nullable: true,
	})
	observedCarrier: TunnelCarrier | null;

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
		fieldName: 'drainingAt',
		nullable: true,
	})
	drainingAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'releasedAt',
		nullable: true,
	})
	releasedAt: Date | null;

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
