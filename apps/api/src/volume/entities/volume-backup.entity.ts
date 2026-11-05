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
import { ENCRYPTION_ENVELOPE_VERSION } from '../../infra/encryption/constants/encryption.constants';
import { Organization } from '../../organization/entities/organization.entity';
import { VolumeBackupState } from '../enums/volume-backup-state.enum';
import { Volume } from './volume.entity';

@Entity({ tableName: 'volume_backup' })
@Unique({
	name: 'UQ_volume_backup_generation',
	properties: ['volumeId', 'backupGeneration'],
})
@Index({
	name: 'IDX_volume_backup_sandbox_state',
	properties: ['sandboxId', 'state'],
})
@Check({
	name: 'CHK_volume_backup_data_key_envelope_version',
	expression: `"dataKeyEnvelopeVersion" = ${ENCRYPTION_ENVELOPE_VERSION}`,
})
export class VolumeBackup {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'artifactId',
	})
	artifactId: string;

	@ManyToOne({
		entity: () => Volume,
		mapToPk: true,
		joinColumn: 'volumeId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_volume_backup_volume',
	})
	volumeId: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'organizationId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_volume_backup_organization',
	})
	organizationId: string;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
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
		fieldName: 'backupGeneration',
	})
	backupGeneration: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'attachmentGeneration',
	})
	attachmentGeneration: number;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'fencingToken',
	})
	fencingToken: string;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'baseArtifactId',
		nullable: true,
	})
	baseArtifactId: string | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'chainDepth',
	})
	chainDepth: number;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'dataKeyCiphertext',
	})
	dataKeyCiphertext: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'dataKeyEnvelopeVersion',
		default: ENCRYPTION_ENVELOPE_VERSION,
	})
	dataKeyEnvelopeVersion = ENCRYPTION_ENVELOPE_VERSION;

	@Enum({
		items: () => VolumeBackupState,
		nativeEnumName: 'volume_backup_state_enum',
	})
	state: VolumeBackupState;

	@Property({
		type: BigIntType,
		columnType: 'bigint',
		runtimeType: 'string',
		fieldName: 'packSizeBytes',
		nullable: true,
	})
	packSizeBytes: string | null;

	@Property({
		type: BigIntType,
		columnType: 'bigint',
		runtimeType: 'string',
		fieldName: 'manifestSizeBytes',
		nullable: true,
	})
	manifestSizeBytes: string | null;

	@Property({
		type: BigIntType,
		columnType: 'bigint',
		runtimeType: 'string',
		fieldName: 'changedBytes',
		nullable: true,
	})
	changedBytes: string | null;

	@Property({
		type: 'string[]',
		columnType: 'uuid[]',
		fieldName: 'referencedArtifactIds',
	})
	referencedArtifactIds: string[];

	@Property({
		type: BigIntType,
		columnType: 'bigint',
		runtimeType: 'string',
		fieldName: 'expectedVolumeSizeBytes',
	})
	expectedVolumeSizeBytes: string;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'errorReason',
		nullable: true,
	})
	errorReason?: string | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'completedAt',
		nullable: true,
	})
	completedAt?: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'prunedAt',
		nullable: true,
	})
	prunedAt: Date | null;

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
