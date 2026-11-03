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
	Property,
} from '@mikro-orm/decorators/legacy';
import { Organization } from '../../organization/tenant/entities/organization.entity';
import { Sandbox } from '../../sandbox/instance/entities/sandbox.entity';
import { SECRET_RESOURCE_VERSION_INITIAL } from '../constants/secret.constants';

@Entity({ tableName: 'sandbox_secret_binding_set' })
@Index({
	name: 'IDX_sandbox_secret_binding_set_organization',
	properties: ['organizationId'],
})
@Check({
	name: 'CHK_sandbox_secret_binding_set_version',
	expression: '"resourceVersion" > 0',
})
export class SandboxSecretBindingSet {
	@ManyToOne({
		entity: () => Sandbox,
		mapToPk: true,
		primary: true,
		joinColumn: 'sandboxId',
		columnType: 'varchar',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_secret_binding_set_sandbox',
	})
	sandboxId: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'organizationId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_secret_binding_set_organization',
	})
	organizationId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'resourceVersion',
		default: SECRET_RESOURCE_VERSION_INITIAL,
	})
	resourceVersion = SECRET_RESOURCE_VERSION_INITIAL;

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
