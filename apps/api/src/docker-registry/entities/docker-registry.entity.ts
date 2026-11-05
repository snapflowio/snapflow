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
} from '@mikro-orm/decorators/legacy';
import { Organization } from '../../organization/entities/organization.entity';
import { RegistryType } from '../enums/registry-type.enum';

@Entity({ tableName: 'docker_registry' })
@Index({
	name: 'docker_registry_organizationId_registryType_index',
	properties: ['organizationId', 'registryType'],
})
@Index({
	name: 'IDX_docker_registry_organization_list',
	properties: ['organizationId', 'registryType', 'createdAt', 'id'],
})
export class DockerRegistry {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
	})
	name: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
	})
	url: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
	})
	username: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
	})
	password: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		default: '',
	})
	project: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'organizationId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'restrict',
		foreignKeyName: 'docker_registry_organizationId_fk',
	})
	organizationId: string | null;

	@Enum({
		items: () => RegistryType,
		nativeEnumName: 'docker_registry_registrytype_enum',
		fieldName: 'registryType',
		default: RegistryType.INTERNAL,
	})
	registryType: RegistryType;

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
