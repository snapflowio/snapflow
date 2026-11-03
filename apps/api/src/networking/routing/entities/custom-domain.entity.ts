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
	Unique,
} from '@mikro-orm/decorators/legacy';
import { Organization } from '../../../organization/tenant/entities/organization.entity';
import { Sandbox } from '../../../sandbox/instance/entities/sandbox.entity';
import {
	CUSTOM_DOMAIN_STATE,
	type CustomDomainState,
} from '../constants/exposure.constants';
import { NETWORKING_LIMITS } from '../constants/networking.constants';
import { NETWORKING_DATABASE_CHECK } from '../constants/networking-database-check.constants';
import type { DomainVerificationRecord } from '../types/networking.types';
import { Exposure } from './exposure.entity';

@Entity({ tableName: 'sandbox_custom_domain' })
@Check({
	name: 'CHK_sandbox_custom_domain_generation',
	expression: '"desiredGeneration" > 0',
})
@Check({
	name: 'CHK_sandbox_custom_domain_observed_generation',
	expression: '"observedGeneration" >= 0',
})
@Check({
	name: 'CHK_sandbox_custom_domain_state',
	expression: NETWORKING_DATABASE_CHECK.customDomainState,
})
@Unique({
	name: 'UQ_sandbox_custom_domain_hostname',
	properties: ['hostname'],
})
@Index({
	name: 'IDX_sandbox_custom_domain_exposure_state',
	properties: ['exposureId', 'state'],
})
@Index({
	name: 'IDX_sandbox_custom_domain_organization_created',
	properties: ['organizationId', 'createdAt'],
})
export class CustomDomain {
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
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_custom_domain_organization',
	})
	organizationId: string;

	@ManyToOne({
		entity: () => Sandbox,
		mapToPk: true,
		joinColumn: 'sandboxId',
		columnType: 'varchar',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_custom_domain_sandbox',
	})
	sandboxId: string;

	@ManyToOne({
		entity: () => Exposure,
		mapToPk: true,
		joinColumn: 'exposureId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_custom_domain_exposure',
	})
	exposureId: string;

	@Property({
		type: 'string',
		columnType: `varchar(${NETWORKING_LIMITS.maximumHostnameLength})`,
	})
	hostname: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		default: CUSTOM_DOMAIN_STATE.PENDING,
	})
	state: CustomDomainState = CUSTOM_DOMAIN_STATE.PENDING;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'desiredGeneration',
		default: 1,
	})
	desiredGeneration = 1;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'observedGeneration',
		default: 0,
	})
	observedGeneration = 0;

	@Property({
		type: 'string',
		columnType: `varchar(${NETWORKING_LIMITS.maximumVersionLength})`,
		fieldName: 'providerId',
		nullable: true,
	})
	providerId: string | null;

	@Property({
		type: 'string',
		columnType: `varchar(${NETWORKING_LIMITS.maximumVersionLength})`,
		fieldName: 'providerHostnameStatus',
		nullable: true,
	})
	providerHostnameStatus: string | null;

	@Property({
		type: 'string',
		columnType: `varchar(${NETWORKING_LIMITS.maximumVersionLength})`,
		fieldName: 'certificateStatus',
		nullable: true,
	})
	certificateStatus: string | null;

	@Property({
		type: 'string',
		columnType: `varchar(${NETWORKING_LIMITS.maximumHostnameLength})`,
		fieldName: 'originHostname',
		nullable: true,
	})
	originHostname: string | null;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'verificationRecords',
		defaultRaw: "'[]'::jsonb",
	})
	verificationRecords: DomainVerificationRecord[] = [];

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'activatedAt',
		nullable: true,
	})
	activatedAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'lastSynchronizedAt',
		nullable: true,
	})
	lastSynchronizedAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'deletionRequestedAt',
		nullable: true,
	})
	deletionRequestedAt: Date | null;

	@Property({
		type: 'string',
		columnType: `varchar(${NETWORKING_LIMITS.maximumErrorLength})`,
		fieldName: 'lastError',
		nullable: true,
	})
	lastError: string | null;

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
