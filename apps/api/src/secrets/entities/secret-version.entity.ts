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
import {
	PLATFORM_PRINCIPAL_TYPE,
	type PlatformPrincipalType,
} from '../../common/types/platform-principal.types';
import { Secret } from './secret.entity';

const platformPrincipalTypes = Object.values(PLATFORM_PRINCIPAL_TYPE)
	.map((principalType) => `'${principalType}'`)
	.join(', ');

@Entity({ tableName: 'secret_version' })
@Index({
	name: 'UQ_secret_version_number',
	expression:
		'create unique index "UQ_secret_version_number" on "secret_version" ("secretId", "version")',
})
@Index({
	name: 'UQ_secret_version_identity',
	expression:
		'create unique index "UQ_secret_version_identity" on "secret_version" ("id", "organizationId", "secretId")',
})
@Check({
	name: 'CHK_secret_version_positive',
	expression: '"version" > 0',
})
@Check({
	name: 'CHK_secret_version_resource_version',
	expression: '"resourceVersion" > 0',
})
@Check({
	name: 'CHK_secret_version_principal_type',
	expression: `"createdByPrincipalType" in (${platformPrincipalTypes})`,
})
export class SecretVersion {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'organizationId',
	})
	organizationId: string;

	@ManyToOne({
		entity: () => Secret,
		mapToPk: true,
		joinColumns: ['secretId', 'organizationId'],
		referencedColumnNames: ['id', 'organizationId'],
		ownColumns: ['secretId'],
		columnTypes: ['uuid', 'uuid'],
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_secret_version_secret',
	})
	secretId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
	})
	version: number;

	@Property({
		type: 'smallint',
		columnType: 'smallint',
		fieldName: 'envelopeFormatVersion',
	})
	envelopeFormatVersion: number;

	@Property({
		type: 'string',
		columnType: 'varchar(128)',
		fieldName: 'keyEncryptionKeyId',
	})
	keyEncryptionKeyId: string;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'encryptedEnvelope',
		lazy: true,
		hidden: true,
	})
	encryptedEnvelope: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'createdByPrincipalType',
	})
	createdByPrincipalType: PlatformPrincipalType;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'createdByPrincipalId',
	})
	createdByPrincipalId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'resourceVersion',
		default: 1,
	})
	resourceVersion: number;

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
		fieldName: 'revokedAt',
		nullable: true,
	})
	revokedAt: Date | null;
}
