/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { OptionalProps, type Rel } from '@mikro-orm/core';
import {
	Entity,
	Enum,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { Organization } from '../../../organization/entities/organization.entity';
import {
	DEFAULT_SNAPSHOT_CPU,
	DEFAULT_SNAPSHOT_DISK_GIB,
	DEFAULT_SNAPSHOT_GPU,
	DEFAULT_SNAPSHOT_IMAGE_NAME,
	DEFAULT_SNAPSHOT_MEMORY_GIB,
} from '../../constants/sandbox.constants';
import { SandboxClass } from '../../enums/sandbox-class.enum';
import { GpuType } from '../../machine/enums/gpu-type.enum';
import { SnapshotState } from '../enums/snapshot-state.enum';
import { BuildInfo } from './build-info.entity';

@Entity({ tableName: 'snapshot' })
@Unique({
	name: 'UQ_snapshot_organization_name',
	properties: ['organizationId', 'name'],
})
@Index({
	name: 'snapshot_name_idx',
	properties: ['name'],
})
@Index({
	name: 'snapshot_state_idx',
	properties: ['state'],
})
@Index({
	name: 'IDX_snapshot_state_updated',
	properties: ['state', 'updatedAt', 'id'],
})
@Index({
	name: 'IDX_snapshot_organization_created',
	properties: ['organizationId', 'general', 'createdAt', 'id'],
})
@Index({
	name: 'IDX_snapshot_organization_last_used',
	expression:
		'create index "IDX_snapshot_organization_last_used" on "snapshot" ("organizationId", general, "lastUsedAt" desc nulls last, "createdAt" desc, id desc)',
})
export class Snapshot {
	[OptionalProps]?: 'hideFromUsers' | 'createdAt' | 'updatedAt';

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
		nullable: true,
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_snapshot_organization',
	})
	organizationId?: string | null;

	@Property({
		type: 'boolean',
		default: false,
	})
	general = false;

	@Property({
		type: 'string',
		columnType: 'varchar',
	})
	name: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'imageName',
		default: DEFAULT_SNAPSHOT_IMAGE_NAME,
	})
	imageName = DEFAULT_SNAPSHOT_IMAGE_NAME;

	@Property({
		type: 'string',
		columnType: 'varchar',
		nullable: true,
	})
	ref?: string | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		nullable: true,
	})
	digest?: string | null;

	@Enum({
		items: () => SnapshotState,
		nativeEnumName: 'snapshot_state_enum',
		default: SnapshotState.PENDING,
	})
	state = SnapshotState.PENDING;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'errorReason',
		nullable: true,
	})
	errorReason: string | null;

	@Property({
		type: 'number',
		columnType: 'double precision',
		nullable: true,
	})
	size?: number | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		default: DEFAULT_SNAPSHOT_CPU,
	})
	cpu = DEFAULT_SNAPSHOT_CPU;

	@Property({
		type: 'integer',
		columnType: 'integer',
		default: DEFAULT_SNAPSHOT_GPU,
	})
	gpu = DEFAULT_SNAPSHOT_GPU;

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
		default: DEFAULT_SNAPSHOT_MEMORY_GIB,
	})
	mem = DEFAULT_SNAPSHOT_MEMORY_GIB;

	@Property({
		type: 'integer',
		columnType: 'integer',
		default: DEFAULT_SNAPSHOT_DISK_GIB,
	})
	disk = DEFAULT_SNAPSHOT_DISK_GIB;

	@Property({
		type: 'boolean',
		fieldName: 'hideFromUsers',
		default: false,
	})
	hideFromUsers = false;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'sandboxClass',
		default: SandboxClass.LINUX_VM,
	})
	sandboxClass: SandboxClass = SandboxClass.LINUX_VM;

	@Property({
		type: 'string[]',
		columnType: 'text[]',
		nullable: true,
	})
	entrypoint?: string[] | null;

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

	@Property({
		type: 'datetime',
		columnType: 'timestamp(3)',
		fieldName: 'lastUsedAt',
		nullable: true,
	})
	lastUsedAt?: Date | null;

	@ManyToOne({
		entity: () => BuildInfo,
		inversedBy: 'snapshots',
		joinColumn: 'buildInfoSnapshotRef',
		columnType: 'varchar',
		nullable: true,
		eager: true,
		deleteRule: 'no action',
		updateRule: 'no action',
		foreignKeyName: 'snapshot_buildInfoSnapshotRef_fk',
	})
	buildInfo?: Rel<BuildInfo> | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'initialMachineId',
		nullable: true,
	})
	initialMachineId?: string | null;
}
