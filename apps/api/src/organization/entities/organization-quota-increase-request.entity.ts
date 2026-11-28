/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { OptionalProps } from '@mikro-orm/core';
import {
	Check,
	Entity,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { User } from '../../user/entities/user.entity';
import { QuotaIncreaseRequestStatus } from '../enums/quota-increase-request-status.enum';
import { Organization } from './organization.entity';

const integerColumn = (fieldName: string) =>
	({ type: 'integer', columnType: 'integer', fieldName }) as const;

const userColumn = (joinColumn: string, foreignKeyName: string) =>
	({
		entity: () => User,
		mapToPk: true,
		joinColumn,
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'set null',
		foreignKeyName,
	}) as const;

@Entity({ tableName: 'organization_quota_increase_request' })
@Index({
	name: 'IDX_quota_increase_request_queue',
	properties: ['status', 'createdAt'],
})
@Index({
	name: 'IDX_quota_increase_request_organization',
	properties: ['organizationId', 'createdAt'],
})
@Unique({
	name: 'UQ_quota_increase_request_pending',
	properties: ['organizationId', 'sandboxClass'],
	where: `"status" = '${QuotaIncreaseRequestStatus.PENDING}'`,
})
@Check({
	name: 'CHK_quota_increase_request_status',
	expression: `"status" in (${sqlValueList(QuotaIncreaseRequestStatus)})`,
})
@Check({
	name: 'CHK_quota_increase_request_sandbox_class',
	expression: `"sandboxClass" in (${sqlValueList(SandboxClass)})`,
})
@Check({
	name: 'CHK_quota_increase_request_review',
	expression: `("status" = '${QuotaIncreaseRequestStatus.PENDING}') = ("reviewedAt" is null)`,
})
@Check({
	name: 'CHK_quota_increase_request_amounts',
	expression:
		'"requestedCpu" >= 0 and "requestedMemory" >= 0 and "requestedDisk" >= 0 and "requestedGpu" >= 0',
})
export class OrganizationQuotaIncreaseRequest {
	[OptionalProps]?: 'id' | 'status' | 'createdAt' | 'updatedAt';

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
		foreignKeyName: 'FK_quota_increase_request_organization',
	})
	organizationId: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'sandboxClass',
	})
	sandboxClass: SandboxClass;

	@Property(integerColumn('requestedCpu'))
	requestedCpu: number;

	@Property(integerColumn('requestedMemory'))
	requestedMemory: number;

	@Property(integerColumn('requestedDisk'))
	requestedDisk: number;

	@Property(integerColumn('requestedGpu'))
	requestedGpu: number;

	@Property({ type: 'text', columnType: 'text', fieldName: 'useCase' })
	useCase: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'status',
		default: QuotaIncreaseRequestStatus.PENDING,
	})
	status: QuotaIncreaseRequestStatus = QuotaIncreaseRequestStatus.PENDING;

	@ManyToOne(
		userColumn('requestedBy', 'FK_quota_increase_request_requested_by')
	)
	requestedBy: string | null;

	@ManyToOne(userColumn('reviewedBy', 'FK_quota_increase_request_reviewed_by'))
	reviewedBy: string | null = null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'reviewedAt',
		nullable: true,
	})
	reviewedAt: Date | null = null;

	@Property({
		type: 'text',
		columnType: 'text',
		fieldName: 'decisionReason',
		nullable: true,
	})
	decisionReason: string | null = null;

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
