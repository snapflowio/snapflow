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
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SECRET_LIMITS } from '../constants/secret.constants';
import { Secret } from './secret.entity';
import { SecretVersion } from './secret-version.entity';

const platformPrincipalTypes = Object.values(PLATFORM_PRINCIPAL_TYPE)
	.map((value) => `'${value}'`)
	.join(', ');

@Entity({ tableName: 'sandbox_secret_binding' })
@Index({
	name: 'UQ_sandbox_secret_binding_environment',
	expression:
		'create unique index "UQ_sandbox_secret_binding_environment" on "sandbox_secret_binding" ("sandboxId", "environmentName")',
})
@Index({
	name: 'IDX_sandbox_secret_binding_secret',
	expression:
		'create index "IDX_sandbox_secret_binding_secret" on "sandbox_secret_binding" ("secretId", "secretVersion")',
})
@Check({
	name: 'CHK_sandbox_secret_binding_version',
	expression: '"secretVersion" > 0',
})
@Check({
	name: 'CHK_sandbox_secret_binding_principal_type',
	expression: `"createdByPrincipalType" in (${platformPrincipalTypes})`,
})
export class SandboxSecretBinding {
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
		entity: () => Sandbox,
		mapToPk: true,
		joinColumns: ['sandboxId', 'organizationId'],
		referencedColumnNames: ['id', 'organizationId'],
		ownColumns: ['sandboxId'],
		columnTypes: ['varchar', 'uuid'],
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_secret_binding_sandbox',
	})
	sandboxId: string;

	@Property({
		type: 'string',
		columnType: `varchar(${SECRET_LIMITS.ENVIRONMENT_NAME_MAX_LENGTH})`,
		fieldName: 'environmentName',
	})
	environmentName: string;

	@ManyToOne({
		entity: () => Secret,
		mapToPk: true,
		joinColumns: ['secretId', 'organizationId'],
		referencedColumnNames: ['id', 'organizationId'],
		ownColumns: ['secretId'],
		columnTypes: ['uuid', 'uuid'],
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_secret_binding_secret',
	})
	secretId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'secretVersion',
	})
	secretVersion: number;

	@ManyToOne({
		entity: () => SecretVersion,
		mapToPk: true,
		joinColumns: ['secretVersionId', 'organizationId', 'secretId'],
		referencedColumnNames: ['id', 'organizationId', 'secretId'],
		ownColumns: ['secretVersionId'],
		columnTypes: ['uuid', 'uuid', 'uuid'],
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_secret_binding_version',
	})
	secretVersionId: string;

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
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;
}
