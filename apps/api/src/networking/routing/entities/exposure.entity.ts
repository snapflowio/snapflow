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
	Unique,
} from '@mikro-orm/decorators/legacy';
import { Organization } from '../../../organization/tenant/entities/organization.entity';
import { Sandbox } from '../../../sandbox/instance/entities/sandbox.entity';
import {
	EXPOSURE_DESIRED_STATE,
	EXPOSURE_OBSERVED_STATE,
	EXPOSURE_TARGET_HOST,
	type ExposureDesiredState,
	type ExposureKind,
	type ExposureObservedState,
	type ExposureTargetHost,
	type ExposureVisibility,
	type SystemExposureService,
} from '../constants/exposure.constants';
import {
	NETWORKING_LIMITS,
	type NetworkProtocol,
} from '../constants/networking.constants';
import { NETWORKING_DATABASE_CHECK } from '../constants/networking-database-check.constants';
import type { ExposurePolicy } from '../types/networking.types';

@Entity({ tableName: 'sandbox_exposure' })
@Check({
	name: 'CHK_sandbox_exposure_generation',
	expression: '"generation" > 0',
})
@Check({
	name: 'CHK_sandbox_exposure_kind',
	expression: NETWORKING_DATABASE_CHECK.exposureKind,
})
@Check({
	name: 'CHK_sandbox_exposure_protocol',
	expression: NETWORKING_DATABASE_CHECK.exposureProtocol,
})
@Check({
	name: 'CHK_sandbox_exposure_kind_protocol',
	expression: NETWORKING_DATABASE_CHECK.exposureKindProtocol,
})
@Check({
	name: 'CHK_sandbox_exposure_visibility',
	expression: NETWORKING_DATABASE_CHECK.exposureVisibility,
})
@Check({
	name: 'CHK_sandbox_exposure_target_port',
	expression: `"targetPort" >= ${NETWORKING_LIMITS.minimumPort} and "targetPort" <= ${NETWORKING_LIMITS.maximumPort}`,
})
@Check({
	name: 'CHK_sandbox_exposure_system_service',
	expression: NETWORKING_DATABASE_CHECK.exposureSystemService,
})
@Check({
	name: 'CHK_sandbox_exposure_system_lease',
	expression: NETWORKING_DATABASE_CHECK.exposureSystemLease,
})
@Check({
	name: 'CHK_sandbox_exposure_target',
	expression: NETWORKING_DATABASE_CHECK.exposureTarget,
})
@Check({
	name: 'CHK_sandbox_exposure_desired_state',
	expression: NETWORKING_DATABASE_CHECK.exposureDesiredState,
})
@Check({
	name: 'CHK_sandbox_exposure_observed_state',
	expression: NETWORKING_DATABASE_CHECK.exposureObservedState,
})
@Index({
	name: 'UQ_sandbox_exposure_name',
	expression: `create unique index "UQ_sandbox_exposure_name" on "sandbox_exposure" ("sandboxId", "name") where "desiredState" <> '${EXPOSURE_DESIRED_STATE.DELETED}'`,
})
@Unique({
	name: 'UQ_sandbox_exposure_routing_key',
	properties: ['routingKey'],
})
@Index({
	name: 'UQ_sandbox_exposure_backend_fence',
	expression:
		'create unique index "UQ_sandbox_exposure_backend_fence" on "sandbox_exposure" ("id", "sandboxId", "generation", "protocol", "targetPort")',
})
@Index({
	name: 'UQ_sandbox_exposure_platform_hostname',
	expression:
		'create unique index "UQ_sandbox_exposure_platform_hostname" on "sandbox_exposure" ("platformHostname") where "platformHostname" is not null',
})
@Index({
	name: 'UQ_sandbox_exposure_origin_hostname',
	expression:
		'create unique index "UQ_sandbox_exposure_origin_hostname" on "sandbox_exposure" ("originHostname") where "originHostname" is not null',
})
@Index({
	name: 'IDX_sandbox_exposure_organization_state',
	properties: ['organizationId', 'observedState'],
})
@Index({
	name: 'UQ_sandbox_exposure_system_service',
	expression: `create unique index "UQ_sandbox_exposure_system_service" on "sandbox_exposure" ("sandboxId", "systemService") where "systemService" is not null and "desiredState" <> '${EXPOSURE_DESIRED_STATE.DELETED}'`,
})
export class Exposure {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'organizationId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_exposure_organization',
	})
	organizationId: string;

	@ManyToOne({
		entity: () => Sandbox,
		mapToPk: true,
		joinColumn: 'sandboxId',
		columnType: 'varchar',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_exposure_sandbox',
	})
	sandboxId: string;

	@Property({
		type: 'string',
		columnType: `varchar(${NETWORKING_LIMITS.maximumNameLength})`,
	})
	name: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
	})
	kind: ExposureKind;

	@Property({
		type: 'string',
		columnType: 'varchar',
	})
	protocol: NetworkProtocol;

	@Property({
		type: 'string',
		columnType: 'varchar',
		nullable: true,
	})
	visibility: ExposureVisibility | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'systemService',
		nullable: true,
	})
	systemService: SystemExposureService | null;

	@Property({
		type: 'string',
		columnType: `varchar(${NETWORKING_LIMITS.maximumHostnameLength})`,
		fieldName: 'targetHost',
		default: EXPOSURE_TARGET_HOST.RUNTIME,
	})
	targetHost: ExposureTargetHost = EXPOSURE_TARGET_HOST.RUNTIME;

	@Property({
		type: 'string',
		columnType: `varchar(${NETWORKING_LIMITS.maximumTargetReferenceLength})`,
		fieldName: 'targetReference',
		nullable: true,
	})
	targetReference: string | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'targetPort',
	})
	targetPort: number;

	@Property({
		type: 'json',
		columnType: 'jsonb',
	})
	policy: ExposurePolicy;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'desiredState',
		default: EXPOSURE_DESIRED_STATE.ACTIVE,
	})
	desiredState: ExposureDesiredState = EXPOSURE_DESIRED_STATE.ACTIVE;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'observedState',
		default: EXPOSURE_OBSERVED_STATE.PENDING,
	})
	observedState: ExposureObservedState = EXPOSURE_OBSERVED_STATE.PENDING;

	@Property({
		type: 'integer',
		columnType: 'integer',
		default: 1,
	})
	generation = 1;

	@Property({
		type: 'string',
		columnType: `char(${NETWORKING_LIMITS.sha256HexLength})`,
		fieldName: 'routingKey',
	})
	routingKey: string;

	@Property({
		type: 'string',
		columnType: `varchar(${NETWORKING_LIMITS.maximumHostnameLength})`,
		fieldName: 'platformHostname',
		nullable: true,
	})
	platformHostname: string | null;

	@Property({
		type: 'string',
		columnType: `varchar(${NETWORKING_LIMITS.maximumHostnameLength})`,
		fieldName: 'originHostname',
		nullable: true,
	})
	originHostname: string | null;

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
		fieldName: 'deletionRequestedAt',
		nullable: true,
	})
	deletionRequestedAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'managedDnsDeletedAt',
		nullable: true,
	})
	managedDnsDeletedAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'systemRequestedUntil',
		nullable: true,
	})
	systemRequestedUntil: Date | null;

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
