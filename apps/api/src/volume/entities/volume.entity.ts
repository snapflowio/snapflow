/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Entity,
	Enum,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { Organization } from '../../organization/entities/organization.entity';
import { VolumeBackupState } from '../enums/volume-backup-state.enum';
import { VolumeState } from '../enums/volume-state.enum';

@Entity({ tableName: 'volume' })
@Unique({
	name: 'UQ_volume_organization_name',
	properties: ['organizationId', 'name'],
	where: `"state" <> '${VolumeState.DELETED}'`,
})
@Index({
	name: 'IDX_volume_pending_delete',
	expression:
		'create index "IDX_volume_pending_delete" on "volume" ("createdAt", "id") where "state" = \'pending_delete\'',
})
@Index({
	name: 'IDX_volume_organization_list',
	expression:
		'create index "IDX_volume_organization_list" on "volume" ("organizationId", "lastUsedAt" desc nulls last, "createdAt" desc, id desc)',
})
export class Volume {
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
		foreignKeyName: 'FK_volume_organization',
	})
	organizationId: string | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
	})
	name: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'sizeGiB',
		default: 10,
	})
	sizeGiB: number;

	@Property({
		type: 'string',
		columnType: 'varchar',
		default: 'ext4',
	})
	filesystem: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		default: 1,
	})
	generation: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'targetSizeGiB',
		nullable: true,
	})
	targetSizeGiB?: number | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'attachmentGeneration',
		default: 0,
	})
	attachmentGeneration: number;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'activeAttachmentId',
		nullable: true,
	})
	activeAttachmentId?: string | null;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'activeMachineId',
		nullable: true,
	})
	activeMachineId?: string | null;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'homeMachineId',
		nullable: true,
	})
	homeMachineId?: string | null;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'fencingToken',
		nullable: true,
	})
	fencingToken?: string | null;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'backupArtifactId',
		nullable: true,
	})
	backupArtifactId?: string | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'backupGeneration',
		nullable: true,
	})
	backupGeneration?: number | null;

	@Enum({
		items: () => VolumeBackupState,
		nativeEnumName: 'volume_backup_state_enum',
		fieldName: 'backupState',
		default: VolumeBackupState.NONE,
	})
	backupState = VolumeBackupState.NONE;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'lastBackupAt',
		nullable: true,
	})
	lastBackupAt?: Date | null;

	@Enum({
		items: () => VolumeState,
		nativeEnumName: 'volume_state_enum',
		default: VolumeState.READY,
	})
	state: VolumeState;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'errorReason',
		nullable: true,
	})
	errorReason?: string | null;

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
}
