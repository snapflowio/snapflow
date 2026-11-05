/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { JsonObject } from '@bufbuild/protobuf';
import { DecimalType, type Rel } from '@mikro-orm/core';
import {
	Check,
	Entity,
	Enum,
	Index,
	ManyToOne,
	OneToOne,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { SandboxLifecycle } from '@snapflow/machine-proto';
import { v4 as uuidv4 } from 'uuid';
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import {
	CITY_COLUMN,
	CONTINENT_COLUMN,
	COUNTRY_COLUMN,
	GEO_COORDINATE_COLUMN,
} from '../../location/entities/location.columns';
import type { Continent } from '../../location/enums/continent.enum';
import { MARKETPLACE_MONEY_COLUMN_TYPE } from '../../marketplace/constants/marketplace.constants';
import { MachineCategory } from '../../marketplace/enums/machine-category.enum';
import { MachineTier } from '../../marketplace/enums/machine-tier.enum';
import { PlacementKind } from '../../marketplace/enums/placement-kind.enum';
import { Organization } from '../../organization/entities/organization.entity';
import {
	DEFAULT_SANDBOX_CPU,
	DEFAULT_SANDBOX_DELETE_INTERVAL_MINUTES,
	DEFAULT_SANDBOX_DISK_GIB,
	DEFAULT_SANDBOX_GPU,
	DEFAULT_SANDBOX_MEMORY_GIB,
	DEFAULT_SANDBOX_STOP_INTERVAL_MINUTES,
	RETENTION_ARCHIVE_INTERVAL_MINUTES,
	SOFT_DELETED_SANDBOX_NAME_PREFIX,
} from '../constants/sandbox.constants';
import {
	ERROR_RECOVERY_TARGETS,
	ERRORED_SANDBOX_STATES,
	RESTING_STATE_BY_DESIRED_STATE,
	SYNCHRONIZATION_TERMINAL_STATES,
} from '../constants/sandbox-state-machine.constants';
import { SandboxCapability } from '../enums/sandbox-capability.enum';
import { SandboxClass } from '../enums/sandbox-class.enum';
import { SandboxDesiredState } from '../enums/sandbox-desired-state.enum';
import { SandboxMode } from '../enums/sandbox-mode.enum';
import { SandboxState } from '../enums/sandbox-state.enum';
import { Machine } from '../machine/entities/machine.entity';
import { GpuType } from '../machine/enums/gpu-type.enum';
import { protoEnumCheckExpression } from '../machine/utils/proto/proto-enum.util';
import { BuildInfo } from '../snapshot/entities/build-info.entity';
import type {
	SandboxBackupSnapshot,
	SandboxVolumeMount,
} from '../types/sandbox-storage.types';
import { getSandboxInvariantChanges } from '../utils/state/sandbox-invariants.util';
import { assertSandboxDesiredStateAcceptsState } from '../utils/state/sandbox-state-validation.util';
import { BackupState } from '../volume/enums/backup-state.enum';
import { SandboxLastActivity } from './sandbox-last-activity.entity';

@Entity({ tableName: 'sandbox' })
@Unique({
	name: 'UQ_sandbox_organization_name',
	properties: ['organizationId', 'name'],
})
@Index({
	name: 'UQ_sandbox_id_organization',
	expression:
		'create unique index "UQ_sandbox_id_organization" on "sandbox" ("id", "organizationId")',
})
@Index({ name: 'sandbox_state_idx', properties: ['state'] })
@Index({ name: 'sandbox_desiredstate_idx', properties: ['desiredState'] })
@Index({ name: 'sandbox_snapshot_idx', properties: ['snapshot'] })
@Index({ name: 'sandbox_machineid_idx', properties: ['machineId', 'id'] })
@Index({
	name: 'sandbox_machine_state_idx',
	properties: ['machineId', 'state'],
})
@Index({
	name: 'IDX_sandbox_organization',
	properties: ['organizationId'],
})
@Index({
	name: 'IDX_sandbox_organization_state_created',
	properties: ['organizationId', 'state', 'createdAt', 'id'],
})
@Index({ name: 'sandbox_location_idx', properties: ['continent', 'country'] })
@Index({
	name: 'sandbox_resources_idx',
	properties: ['cpu', 'mem', 'disk', 'gpu'],
})
@Index({ name: 'sandbox_backupstate_idx', properties: ['backupState'] })
@Index({
	name: 'sandbox_machine_state_desired_idx',
	properties: ['machineId', 'state', 'desiredState'],
	where: '"pending" = false',
})
@Index({
	name: 'IDX_sandbox_lifecycle_pending',
	properties: ['state', 'desiredState', 'id'],
	where: '"pending" = false',
})
@Index({
	name: 'IDX_sandbox_backup_in_progress',
	properties: ['id'],
	where: `"backupState" = '${BackupState.IN_PROGRESS}' and "desiredState" <> '${SandboxDesiredState.DESTROYED}'`,
})
@Index({
	name: 'IDX_sandbox_backup_retry',
	properties: ['id'],
	where: `"backupState" = '${BackupState.ERROR}' and "desiredState" <> '${SandboxDesiredState.DESTROYED}'`,
})
@Index({
	name: 'sandbox_active_only_idx',
	properties: ['id'],
	where:
		"\"state\" <> all (array['destroyed'::sandbox_state_enum, 'archived'::sandbox_state_enum])",
})
@Index({
	name: 'sandbox_pending_idx',
	properties: ['id'],
	where: '"pending" = true',
})
@Index({
	name: 'IDX_sandbox_pending_machine_updated',
	properties: ['machineId', 'updatedAt', 'id'],
	where: '"pending" = true',
})
@Index({
	name: 'idx_sandbox_recoverable',
	properties: ['id'],
	where: '"recoverable" = true',
})
@Index({
	name: 'sandbox_buildinfosnapshotref_idx',
	expression:
		'create index "sandbox_buildinfosnapshotref_idx" on "sandbox" ("buildInfoSnapshotRef") where "buildInfoSnapshotRef" is not null',
})
@Index({
	name: 'sandbox_labels_gin_full_idx',
	expression:
		'create index "sandbox_labels_gin_full_idx" on "sandbox" using gin ("labels" jsonb_path_ops)',
})
@Index({
	name: 'idx_sandbox_volumes_gin',
	expression:
		'create index "idx_sandbox_volumes_gin" on "sandbox" using gin ("volumes" jsonb_path_ops) where "desiredState" <> \'destroyed\'',
})
@Index({
	name: 'sandbox_linked_sandbox_id_idx',
	properties: ['linkedSandboxId'],
})
@Index({
	name: 'UQ_sandbox_active_linked_owner',
	expression:
		'create unique index "UQ_sandbox_active_linked_owner" on "sandbox" ("linkedSandboxId") where "linkedSandboxId" is not null and "desiredState" <> \'destroyed\'',
})
@Check({
	name: 'CHK_sandbox_runtime_lifecycle',
	expression: protoEnumCheckExpression(
		'runtimeLifecycle',
		SandboxLifecycle,
		true
	),
})
@Check({
	name: 'CHK_sandbox_runtime_assignment',
	expression:
		'"runtimeLifecycle" is null or ("machineId" is not null and "runtimeSpecDigest" is not null)',
})
@Check({
	name: 'CHK_sandbox_spec_generation',
	expression: '"specGeneration" >= 0',
})
@Check({
	name: 'CHK_sandbox_pin',
	expression: `("placementKind" = '${PlacementKind.PINNED}') = ("pinnedMachineId" is not null)`,
})
@Check({
	name: 'CHK_sandbox_placement_kind',
	expression: `"placementKind" in (${sqlValueList(PlacementKind)})`,
})
@Check({
	name: 'CHK_sandbox_placement_category',
	expression: `"placementCategory" is null or "placementCategory" in (${sqlValueList(MachineCategory)})`,
})
@Check({
	name: 'CHK_sandbox_placement_minimum_tier',
	expression: `"placementMinimumTier" is null or "placementMinimumTier" in (${sqlValueList(MachineTier)})`,
})
@Check({
	name: 'CHK_sandbox_max_hourly_price',
	expression:
		'"maxHourlyPriceMicroUsd" is null or "maxHourlyPriceMicroUsd" >= 0',
})
@Check({
	name: 'CHK_sandbox_max_egress_price',
	expression:
		'"maxEgressMicroUsdPerGiB" is null or "maxEgressMicroUsdPerGiB" >= 0',
})
export class Sandbox {
	@PrimaryKey({
		type: 'string',
		columnType: 'varchar',
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
		foreignKeyName: 'FK_sandbox_organization',
	})
	organizationId: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
	})
	name: string;

	@Property({ ...COUNTRY_COLUMN, fieldName: 'country' })
	country: string | null = null;

	@Enum({ ...CONTINENT_COLUMN, fieldName: 'continent' })
	continent: Continent | null = null;

	@Property({ ...CITY_COLUMN, fieldName: 'city' })
	city: string | null = null;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'machineId',
		nullable: true,
	})
	machineId: string | null;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'prevMachineId',
		nullable: true,
	})
	prevMachineId?: string | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'placementKind',
		default: PlacementKind.FLEXIBLE,
	})
	placementKind: PlacementKind = PlacementKind.FLEXIBLE;

	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		joinColumn: 'pinnedMachineId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_pinned_machine',
	})
	pinnedMachineId: string | null = null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'placementCategory',
		nullable: true,
	})
	placementCategory: MachineCategory | null = null;

	@Property({
		type: 'string[]',
		columnType: 'text[]',
		fieldName: 'placementLocations',
		defaultRaw: `'{}'`,
	})
	placementLocations: string[] = [];

	@Property({
		type: 'boolean',
		fieldName: 'placementOwnMachinesOnly',
		default: false,
	})
	placementOwnMachinesOnly = false;

	@Property({ ...GEO_COORDINATE_COLUMN, fieldName: 'originLatitude' })
	originLatitude: number | null = null;

	@Property({ ...GEO_COORDINATE_COLUMN, fieldName: 'originLongitude' })
	originLongitude: number | null = null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'placementMinimumTier',
		nullable: true,
	})
	placementMinimumTier: MachineTier | null = null;

	@Property({
		type: DecimalType,
		columnType: MARKETPLACE_MONEY_COLUMN_TYPE,
		runtimeType: 'string',
		fieldName: 'maxHourlyPriceMicroUsd',
		nullable: true,
	})
	maxHourlyPriceMicroUsd: string | null = null;

	@Property({
		type: DecimalType,
		columnType: MARKETPLACE_MONEY_COLUMN_TYPE,
		runtimeType: 'string',
		fieldName: 'maxEgressMicroUsdPerGiB',
		nullable: true,
	})
	maxEgressMicroUsdPerGiB: string | null = null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'startWaitUntil',
		nullable: true,
	})
	startWaitUntil: Date | null = null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'sandboxClass',
		default: SandboxClass.LINUX_VM,
	})
	sandboxClass: SandboxClass = SandboxClass.LINUX_VM;

	@Enum({
		items: () => SandboxMode,
		nativeEnumName: 'sandbox_mode_enum',
	})
	mode: SandboxMode;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		defaultRaw: "'[]'::jsonb",
	})
	capabilities: SandboxCapability[] = [];

	@Enum({
		items: () => SandboxState,
		nativeEnumName: 'sandbox_state_enum',
		default: SandboxState.UNKNOWN,
	})
	state = SandboxState.UNKNOWN;

	@Enum({
		items: () => SandboxDesiredState,
		nativeEnumName: 'sandbox_desiredstate_enum',
		fieldName: 'desiredState',
		default: SandboxDesiredState.STARTED,
	})
	desiredState = SandboxDesiredState.STARTED;

	@Property({
		type: 'string',
		columnType: 'varchar',
		nullable: true,
	})
	snapshot?: string | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'osUser',
	})
	osUser: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'errorReason',
		nullable: true,
	})
	errorReason: string | null;

	@Property({
		type: 'boolean',
		default: false,
	})
	recoverable = false;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		defaultRaw: "'{}'::jsonb",
	})
	env: Record<string, string> = {};

	@Property({
		type: 'boolean',
		fieldName: 'networkBlockAll',
		default: false,
	})
	networkBlockAll = false;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'networkAllowList',
		nullable: true,
	})
	networkAllowList: string | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'domainAllowList',
		nullable: true,
	})
	domainAllowList: string | null;

	@Property({
		type: 'number',
		columnType: 'double precision',
		fieldName: 'egressBandwidthBps',
		nullable: true,
	})
	egressBandwidthBps?: number | null;

	@Property({
		type: 'number',
		columnType: 'double precision',
		fieldName: 'networkThrottleBandwidthBps',
		nullable: true,
	})
	networkThrottleBandwidthBps: number | null = null;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		nullable: true,
	})
	labels: Record<string, string> | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'backupRegistryId',
		nullable: true,
	})
	backupRegistryId: string | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'backupSnapshot',
		nullable: true,
	})
	backupSnapshot: string | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'lastBackupAt',
		nullable: true,
	})
	lastBackupAt: Date | null;

	@Enum({
		items: () => BackupState,
		nativeEnumName: 'sandbox_backupstate_enum',
		fieldName: 'backupState',
		default: BackupState.NONE,
	})
	backupState = BackupState.NONE;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'backupErrorReason',
		nullable: true,
	})
	backupErrorReason: string | null;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'existingBackupSnapshots',
		defaultRaw: "'[]'::jsonb",
	})
	existingBackupSnapshots: SandboxBackupSnapshot[] = [];

	@Property({
		type: 'integer',
		columnType: 'integer',
		default: DEFAULT_SANDBOX_CPU,
	})
	cpu = DEFAULT_SANDBOX_CPU;

	@Property({
		type: 'integer',
		columnType: 'integer',
		default: DEFAULT_SANDBOX_GPU,
	})
	gpu = DEFAULT_SANDBOX_GPU;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'gpu_type',
		nullable: true,
	})
	gpuType?: GpuType | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		default: DEFAULT_SANDBOX_MEMORY_GIB,
	})
	mem = DEFAULT_SANDBOX_MEMORY_GIB;

	@Property({
		type: 'integer',
		columnType: 'integer',
		default: DEFAULT_SANDBOX_DISK_GIB,
	})
	disk = DEFAULT_SANDBOX_DISK_GIB;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		defaultRaw: "'[]'::jsonb",
	})
	volumes: SandboxVolumeMount[] = [];

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

	@OneToOne({
		entity: () => SandboxLastActivity,
		mappedBy: 'sandbox',
	})
	lastActivityAt?: Rel<SandboxLastActivity>;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'autoStopInterval',
		default: DEFAULT_SANDBOX_STOP_INTERVAL_MINUTES,
	})
	autoStopInterval: number | undefined = DEFAULT_SANDBOX_STOP_INTERVAL_MINUTES;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'autoArchiveInterval',
		default: RETENTION_ARCHIVE_INTERVAL_MINUTES,
	})
	autoArchiveInterval: number | undefined = RETENTION_ARCHIVE_INTERVAL_MINUTES;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'autoDeleteInterval',
		default: DEFAULT_SANDBOX_DELETE_INTERVAL_MINUTES,
	})
	autoDeleteInterval: number | undefined =
		DEFAULT_SANDBOX_DELETE_INTERVAL_MINUTES;

	@Property({
		type: 'boolean',
		default: false,
	})
	pending: boolean | undefined = false;

	@ManyToOne({
		entity: () => BuildInfo,
		inversedBy: 'sandboxes',
		joinColumn: 'buildInfoSnapshotRef',
		columnType: 'varchar',
		nullable: true,
		deleteRule: 'no action',
		updateRule: 'no action',
		foreignKeyName: 'sandbox_buildInfoSnapshotRef_fk',
	})
	buildInfo?: Rel<BuildInfo> | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'daemonVersion',
		nullable: true,
	})
	daemonVersion?: string | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'linkedSandboxId',
		nullable: true,
	})
	linkedSandboxId?: string | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'specGeneration',
		default: 0,
	})
	specGeneration = 0;

	@Property({
		type: 'smallint',
		columnType: 'smallint',
		fieldName: 'runtimeLifecycle',
		nullable: true,
	})
	runtimeLifecycle: SandboxLifecycle | null = null;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'runtimeSpec',
		nullable: true,
		lazy: true,
	})
	runtimeSpec: JsonObject | null = null;

	@Property({
		type: 'string',
		columnType: 'varchar(64)',
		fieldName: 'runtimeSpecDigest',
		nullable: true,
	})
	runtimeSpecDigest: string | null = null;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'runtimeDirectives',
		nullable: true,
		lazy: true,
	})
	runtimeDirectives: JsonObject | null = null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'runtimeRegistryId',
		nullable: true,
	})
	runtimeRegistryId: string | null = null;

	constructor(params?: { name?: string }) {
		if (!params) return;

		this.id = uuidv4();
		this.name = params.name || this.id;
	}

	locateOn(machine: Pick<Machine, 'country' | 'continent' | 'city'>): void {
		this.country = machine.country;
		this.continent = machine.continent;
		this.city = machine.city;
	}

	static getBackupStateUpdate(
		sandbox: Sandbox,
		backupState: BackupState,
		backupSnapshot?: string | null,
		backupRegistryId?: string | null,
		backupErrorReason?: string | null,
		recoverable?: boolean
	): Partial<Sandbox> {
		const update: Partial<Sandbox> = { backupState };

		switch (backupState) {
			case BackupState.NONE:
				update.backupSnapshot = null;
				break;
			case BackupState.COMPLETED: {
				const now = new Date();
				update.lastBackupAt = now;
				const completedSnapshot = sandbox.backupSnapshot ?? backupSnapshot;

				if (completedSnapshot) {
					update.existingBackupSnapshots = [
						...sandbox.existingBackupSnapshots,
						{
							snapshotName: completedSnapshot,
							createdAt: now,
						},
					];
				}

				update.backupErrorReason = null;
				break;
			}
		}

		if (backupSnapshot !== undefined) {
			update.backupSnapshot = backupSnapshot;
		}
		if (backupRegistryId !== undefined) {
			update.backupRegistryId = backupRegistryId;
		}
		if (backupErrorReason !== undefined) {
			update.backupErrorReason = backupErrorReason;
		}
		if (recoverable !== undefined) {
			update.recoverable = recoverable;
		}

		return update;
	}

	static getSoftDeleteName(originalName: string): string {
		return `${SOFT_DELETED_SANDBOX_NAME_PREFIX}${originalName}_${Date.now()}`;
	}

	static getSoftDeleteUpdate(sandbox: Sandbox): Partial<Sandbox> {
		return {
			pending: true,
			desiredState: SandboxDesiredState.DESTROYED,
			backupState: BackupState.NONE,
			name: Sandbox.getSoftDeleteName(sandbox.name),
		};
	}

	assertValid(): void {
		assertSandboxDesiredStateAcceptsState(this);
	}

	isErrored(): boolean {
		return ERRORED_SANDBOX_STATES.has(this.state);
	}

	restingState(): SandboxState | null {
		return RESTING_STATE_BY_DESIRED_STATE[this.desiredState] ?? null;
	}

	isStateSynchronizationTerminal(): boolean {
		if (SYNCHRONIZATION_TERMINAL_STATES.has(this.state)) return true;
		return (
			this.state === SandboxState.ERROR &&
			!ERROR_RECOVERY_TARGETS.has(this.desiredState)
		);
	}

	enforceInvariants(): Partial<Sandbox> {
		const changes = getSandboxInvariantChanges(this);
		Object.assign(this, changes);
		return changes;
	}
}
