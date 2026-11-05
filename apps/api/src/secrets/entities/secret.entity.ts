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
import { Organization } from '../../organization/entities/organization.entity';

const platformPrincipalTypes = Object.values(PLATFORM_PRINCIPAL_TYPE)
	.map((principalType) => `'${principalType}'`)
	.join(', ');

@Entity({ tableName: 'secret' })
@Index({
	name: 'UQ_secret_organization_normalized_name',
	expression:
		'create unique index "UQ_secret_organization_normalized_name" on "secret" ("organizationId", "normalizedName")',
})
@Index({
	name: 'UQ_secret_id_organization',
	expression:
		'create unique index "UQ_secret_id_organization" on "secret" ("id", "organizationId")',
})
@Check({
	name: 'CHK_secret_current_version',
	expression: '"currentVersion" > 0',
})
@Check({
	name: 'CHK_secret_resource_version',
	expression: '"resourceVersion" > 0',
})
@Check({
	name: 'CHK_secret_principal_type',
	expression: `"createdByPrincipalType" in (${platformPrincipalTypes})`,
})
export class Secret {
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
		foreignKeyName: 'FK_secret_organization',
	})
	organizationId: string;

	@Property({
		type: 'string',
		columnType: 'varchar(128)',
	})
	name: string;

	@Property({
		type: 'string',
		columnType: 'varchar(128)',
		fieldName: 'normalizedName',
	})
	normalizedName: string;

	@Property({
		type: 'string',
		columnType: 'text',
		nullable: true,
	})
	description: string | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'currentVersion',
		default: 1,
	})
	currentVersion: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'resourceVersion',
		default: 1,
	})
	resourceVersion: number;

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
