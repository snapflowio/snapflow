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
	Enum,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { v4 } from 'uuid';
import { SHA256_HEX_LENGTH } from '../../../common/constants/digest.constants';
import { sqlValueList } from '../../../infra/database/utils/sql-value-list.util';
import {
	CITY_COLUMN,
	CONTINENT_COLUMN,
	COUNTRY_COLUMN,
	GEO_COORDINATE_COLUMN,
} from '../../../location/entities/location.columns';
import type { Continent } from '../../../location/enums/continent.enum';
import { MachineCategory } from '../../../marketplace/enums/machine-category.enum';
import { MachineTier } from '../../../marketplace/enums/machine-tier.enum';
import { Organization } from '../../../organization/entities/organization.entity';
import { MachineBenchmark } from '../../../verification/entities/machine-benchmark.entity';
import { SandboxClass } from '../../enums/sandbox-class.enum';
import {
	JOB_MACHINE_API_VERSION,
	MACHINE_DEVELOPMENT_APP_VERSION,
	MACHINE_READINESS_REASON_MAX_LENGTH,
} from '../constants/machine.constants';
import { GpuType } from '../enums/gpu-type.enum';
import { MachineState } from '../enums/machine-state.enum';
import type {
	MachineRuntimeCapabilities,
	MachineUpdateStatus,
} from '../types/machine-runtime.types';
import type { MachineServiceInfo } from '../types/machine-service-info.types';
import {
	MACHINE_COUNTER_COLUMN,
	MACHINE_MEASUREMENT_COLUMN,
	MACHINE_OPTIONAL_INTEGER_COLUMN,
	MACHINE_OPTIONAL_MEASUREMENT_COLUMN,
	MACHINE_OPTIONAL_STRING_COLUMN,
	MACHINE_OPTIONAL_TIMESTAMP_COLUMN,
} from './machine.columns';

@Entity({ tableName: 'machine' })
@Unique({
	name: 'UQ_machine_organization_name',
	properties: ['organizationId', 'name'],
})
@Index({
	name: 'IDX_machine_state_unschedulable',
	properties: ['state', 'unschedulable'],
})
@Index({
	name: 'IDX_machine_location',
	properties: ['continent', 'country'],
})
@Index({
	name: 'IDX_machine_organization',
	properties: ['organizationId'],
})
@Index({
	name: 'IDX_machine_organization_list',
	properties: ['organizationId', 'createdAt', 'id'],
})
@Unique({
	name: 'IDX_machine_identity_key',
	properties: ['identityKeyId'],
	where: '"identityKeyId" IS NOT NULL',
})
@Index({
	name: 'IDX_machine_scheduling_session',
	properties: ['state', 'unschedulable', 'draining', 'sessionExpiresAt'],
})
@Index({
	name: 'IDX_machine_control_refresh',
	expression:
		'create index "IDX_machine_control_refresh" on "machine" ("tunnelPlanGeneratedAt", "id") where "sessionExpiresAt" is not null',
})
@Index({
	name: 'IDX_machine_draining_worker',
	expression:
		'create index "IDX_machine_draining_worker" on "machine" ("id") where "draining" = true and "state" <> \'decommissioned\'',
})
@Index({
	name: 'IDX_machine_unschedulable_worker',
	expression:
		'create index "IDX_machine_unschedulable_worker" on "machine" ("id") where "unschedulable" = true',
})
@Index({
	name: 'IDX_machine_ready_worker',
	properties: ['id'],
	where: '"state" = \'ready\'',
})
@Index({ name: 'IDX_machine_tier_category', properties: ['tier', 'category'] })
@Check({
	name: 'CHK_machine_gpu',
	expression:
		'("gpuCount" = 0 and "gpuType" is null) or ("gpuCount" > 0 and "gpuType" is not null)',
})
@Check({
	name: 'CHK_machine_tier',
	expression: `"tier" in (${sqlValueList(MachineTier)})`,
})
@Check({
	name: 'CHK_machine_admin_tier_cap',
	expression: `"adminTierCap" is null or "adminTierCap" in (${sqlValueList(MachineTier)})`,
})
@Check({
	name: 'CHK_machine_category',
	expression: `"category" is null or "category" in (${sqlValueList(MachineCategory)})`,
})
@Check({
	name: 'CHK_machine_gpu_type',
	expression: `"gpuType" is null or "gpuType" in (${sqlValueList(GpuType)})`,
})
export class Machine {
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
		foreignKeyName: 'FK_machine_organization',
	})
	organizationId: string;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'identityPublicKey',
		nullable: true,
	})
	identityPublicKey: string | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'identityKeyId',
		nullable: true,
	})
	identityKeyId: string | null;

	@Property({
		...MACHINE_OPTIONAL_TIMESTAMP_COLUMN,
		fieldName: 'identityKeyRegisteredAt',
	})
	identityKeyRegisteredAt: Date | null;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'sshHostPublicKey',
		nullable: true,
	})
	sshHostPublicKey: string | null;

	@Property({
		type: 'string',
		columnType: `varchar(${MACHINE_READINESS_REASON_MAX_LENGTH})`,
		fieldName: 'readinessReason',
		nullable: true,
	})
	readinessReason: string | null;

	@Property({ ...MACHINE_MEASUREMENT_COLUMN })
	cpu: number;

	@Property({ ...MACHINE_MEASUREMENT_COLUMN, fieldName: 'memoryGiB' })
	memoryGiB: number;

	@Property({ ...MACHINE_MEASUREMENT_COLUMN, fieldName: 'diskGiB' })
	diskGiB: number;

	@Property({ ...MACHINE_COUNTER_COLUMN, fieldName: 'passthroughGpuCount' })
	passthroughGpuCount = 0;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'sandboxClass',
		default: SandboxClass.LINUX_VM,
	})
	sandboxClass: SandboxClass = SandboxClass.LINUX_VM;

	@Property({
		...MACHINE_MEASUREMENT_COLUMN,
		fieldName: 'currentCpuUsagePercentage',
	})
	currentCpuUsagePercentage: number;

	@Property({
		...MACHINE_MEASUREMENT_COLUMN,
		fieldName: 'currentMemoryUsagePercentage',
	})
	currentMemoryUsagePercentage: number;

	@Property({
		...MACHINE_MEASUREMENT_COLUMN,
		fieldName: 'currentDiskUsagePercentage',
	})
	currentDiskUsagePercentage: number;

	@Property({ ...MACHINE_MEASUREMENT_COLUMN, fieldName: 'currentAllocatedCpu' })
	currentAllocatedCpu: number;

	@Property({
		...MACHINE_MEASUREMENT_COLUMN,
		fieldName: 'currentAllocatedMemoryGiB',
	})
	currentAllocatedMemoryGiB: number;

	@Property({
		...MACHINE_MEASUREMENT_COLUMN,
		fieldName: 'currentAllocatedDiskGiB',
	})
	currentAllocatedDiskGiB: number;

	@Property({ ...MACHINE_COUNTER_COLUMN, fieldName: 'currentSnapshotCount' })
	currentSnapshotCount: number;

	@Property({ ...MACHINE_COUNTER_COLUMN, fieldName: 'currentStartedSandboxes' })
	currentStartedSandboxes: number;

	@Property({ ...COUNTRY_COLUMN, fieldName: 'country' })
	country: string | null = null;

	@Enum({ ...CONTINENT_COLUMN, fieldName: 'continent' })
	continent: Continent | null = null;

	@Property({ ...CITY_COLUMN, fieldName: 'city' })
	city: string | null = null;

	@Property({ ...GEO_COORDINATE_COLUMN, fieldName: 'latitude' })
	latitude: number | null = null;

	@Property({ ...GEO_COORDINATE_COLUMN, fieldName: 'longitude' })
	longitude: number | null = null;

	@Property({
		type: 'string',
		columnType: 'varchar',
	})
	name: string;

	@Enum({
		items: () => MachineState,
		nativeEnumName: 'machine_state_enum',
		default: MachineState.INITIALIZING,
	})
	state: MachineState;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'appVersion',
		default: MACHINE_DEVELOPMENT_APP_VERSION,
		nullable: true,
	})
	appVersion: string | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'apiVersion',
		default: JOB_MACHINE_API_VERSION,
	})
	apiVersion: string;

	@Property({ ...MACHINE_OPTIONAL_TIMESTAMP_COLUMN, fieldName: 'lastChecked' })
	lastChecked: Date | null;

	@Property({
		type: 'boolean',
		default: false,
	})
	unschedulable: boolean;

	@Property({
		type: 'boolean',
		default: false,
	})
	draining: boolean;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'serviceHealth',
		nullable: true,
	})
	serviceHealth: MachineServiceInfo[] | null;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'runtimeCapabilities',
		nullable: true,
	})
	runtimeCapabilities: MachineRuntimeCapabilities | null;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'updateStatus',
		nullable: true,
	})
	updateStatus: MachineUpdateStatus | null;

	@Property({ ...MACHINE_COUNTER_COLUMN, fieldName: 'sessionGeneration' })
	sessionGeneration: number;

	@Property({
		type: new BigIntType('string'),
		columnType: 'bigint',
		fieldName: 'tunnelPlanVersion',
		defaultRaw: '0',
	})
	tunnelPlanVersion: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'tunnelPlanGeneratedAt',
		defaultRaw: 'CURRENT_TIMESTAMP',
	})
	tunnelPlanGeneratedAt: Date;

	@Property({
		type: new BigIntType('string'),
		columnType: 'bigint',
		fieldName: 'desiredStateRevision',
		defaultRaw: '0',
	})
	desiredStateRevision: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'desiredStateGeneratedAt',
		defaultRaw: 'CURRENT_TIMESTAMP',
	})
	desiredStateGeneratedAt: Date;

	@Property({
		...MACHINE_OPTIONAL_TIMESTAMP_COLUMN,
		fieldName: 'sessionExpiresAt',
	})
	sessionExpiresAt: Date | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'tier',
		default: MachineTier.PRIVATE,
	})
	tier: MachineTier = MachineTier.PRIVATE;

	@Property({
		type: 'string[]',
		columnType: 'text[]',
		fieldName: 'tierReasons',
		defaultRaw: `'{}'`,
	})
	tierReasons: string[] = [];

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'tierChangedAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	tierChangedAt: Date;

	@Property({ ...MACHINE_OPTIONAL_STRING_COLUMN, fieldName: 'adminTierCap' })
	adminTierCap: MachineTier | null = null;

	@Property({
		...MACHINE_OPTIONAL_STRING_COLUMN,
		fieldName: 'adminTierCapReason',
	})
	adminTierCapReason: string | null = null;

	@Property({
		...MACHINE_OPTIONAL_TIMESTAMP_COLUMN,
		fieldName: 'datacenterApprovedAt',
	})
	datacenterApprovedAt: Date | null = null;

	@Property({ ...MACHINE_OPTIONAL_STRING_COLUMN, fieldName: 'category' })
	category: MachineCategory | null = null;

	@Property({ ...MACHINE_OPTIONAL_STRING_COLUMN, fieldName: 'cpuModel' })
	cpuModel: string | null = null;

	@Property({ ...MACHINE_OPTIONAL_INTEGER_COLUMN, fieldName: 'measuredVcpu' })
	measuredVcpu: number | null = null;

	@Property({
		...MACHINE_OPTIONAL_INTEGER_COLUMN,
		fieldName: 'measuredMemoryGib',
	})
	measuredMemoryGib: number | null = null;

	@Property({
		...MACHINE_OPTIONAL_INTEGER_COLUMN,
		fieldName: 'measuredDiskGib',
	})
	measuredDiskGib: number | null = null;

	@Property({
		...MACHINE_OPTIONAL_INTEGER_COLUMN,
		fieldName: 'cpuSingleThreadScore',
	})
	cpuSingleThreadScore: number | null = null;

	@Property({
		...MACHINE_OPTIONAL_INTEGER_COLUMN,
		fieldName: 'cpuScorePerVcpu',
	})
	cpuScorePerVcpu: number | null = null;

	@Property({
		...MACHINE_OPTIONAL_INTEGER_COLUMN,
		fieldName: 'memoryBandwidthMibps',
	})
	memoryBandwidthMibps: number | null = null;

	@Property({
		...MACHINE_OPTIONAL_INTEGER_COLUMN,
		fieldName: 'memoryLatencyNs',
	})
	memoryLatencyNs: number | null = null;

	@Property({
		...MACHINE_OPTIONAL_INTEGER_COLUMN,
		fieldName: 'diskRandomReadIops',
	})
	diskRandomReadIops: number | null = null;

	@Property({
		...MACHINE_OPTIONAL_INTEGER_COLUMN,
		fieldName: 'diskSequentialMibps',
	})
	diskSequentialMibps: number | null = null;

	@Property({
		...MACHINE_OPTIONAL_INTEGER_COLUMN,
		fieldName: 'diskSequentialWriteMibps',
	})
	diskSequentialWriteMibps: number | null = null;

	@Property({
		...MACHINE_OPTIONAL_INTEGER_COLUMN,
		fieldName: 'diskReadLatencyMicros',
	})
	diskReadLatencyMicros: number | null = null;

	@Property({
		...MACHINE_OPTIONAL_INTEGER_COLUMN,
		fieldName: 'diskFsyncLatencyMicros',
	})
	diskFsyncLatencyMicros: number | null = null;

	@Property({
		...MACHINE_OPTIONAL_INTEGER_COLUMN,
		fieldName: 'networkDownlinkMbps',
	})
	networkDownlinkMbps: number | null = null;

	@Property({
		...MACHINE_OPTIONAL_INTEGER_COLUMN,
		fieldName: 'networkUplinkMbps',
	})
	networkUplinkMbps: number | null = null;

	@Property({
		...MACHINE_OPTIONAL_MEASUREMENT_COLUMN,
		fieldName: 'networkMinRttMs',
	})
	networkMinRttMs: number | null = null;

	@Property({
		...MACHINE_OPTIONAL_MEASUREMENT_COLUMN,
		fieldName: 'networkLoadedRttMs',
	})
	networkLoadedRttMs: number | null = null;

	@Property({
		...MACHINE_OPTIONAL_MEASUREMENT_COLUMN,
		fieldName: 'networkJitterMs',
	})
	networkJitterMs: number | null = null;

	@Property({ ...MACHINE_OPTIONAL_STRING_COLUMN, fieldName: 'gpuType' })
	gpuType: GpuType | null = null;

	@Property({ ...MACHINE_COUNTER_COLUMN, fieldName: 'gpuCount' })
	gpuCount = 0;

	@Property({ ...MACHINE_COUNTER_COLUMN, fieldName: 'gpuMemoryGib' })
	gpuMemoryGib = 0;

	@Property({ ...MACHINE_COUNTER_COLUMN, fieldName: 'gpuTflops' })
	gpuTflops = 0;

	@Property({ ...MACHINE_OPTIONAL_TIMESTAMP_COLUMN, fieldName: 'measuredAt' })
	measuredAt: Date | null = null;

	@ManyToOne({
		entity: () => MachineBenchmark,
		mapToPk: true,
		joinColumn: 'latestBenchmarkId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'set null',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_latest_benchmark',
	})
	latestBenchmarkId: string | null = null;

	@Property({
		type: 'string',
		columnType: `varchar(${SHA256_HEX_LENGTH})`,
		fieldName: 'inventoryDigest',
		nullable: true,
	})
	inventoryDigest: string | null = null;

	@Property({
		type: 'string',
		columnType: `varchar(${SHA256_HEX_LENGTH})`,
		fieldName: 'benchmarkedInventoryDigest',
		nullable: true,
	})
	benchmarkedInventoryDigest: string | null = null;

	@Property({
		type: 'boolean',
		fieldName: 'fingerprintConflict',
		default: false,
	})
	fingerprintConflict = false;

	@Property({ ...MACHINE_OPTIONAL_TIMESTAMP_COLUMN, fieldName: 'listedSince' })
	listedSince: Date | null = null;

	@Property({ ...MACHINE_OPTIONAL_TIMESTAMP_COLUMN, fieldName: 'restrictedAt' })
	restrictedAt: Date | null = null;

	@Property({
		...MACHINE_OPTIONAL_STRING_COLUMN,
		fieldName: 'restrictionReason',
	})
	restrictionReason: string | null = null;

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

	constructor(params?: {
		name: string;
		apiVersion: string;
		organizationId: string;
		cpu?: number;
		memoryGiB?: number;
		diskGiB?: number;
		appVersion?: string | null;
		sandboxClass?: SandboxClass;
	}) {
		if (!params) return;
		this.id = v4();
		this.organizationId = params.organizationId;
		this.name = params.name;
		this.cpu = params.cpu ?? 0;
		this.memoryGiB = params.memoryGiB ?? 0;
		this.diskGiB = params.diskGiB ?? 0;
		this.sandboxClass = params.sandboxClass ?? SandboxClass.LINUX_VM;
		this.apiVersion = params.apiVersion;
		this.appVersion = params.appVersion ?? null;
	}
}
