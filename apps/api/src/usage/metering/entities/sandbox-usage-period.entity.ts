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
import { sqlValueList } from '../../../infra/database/utils/sql-value-list.util';
import { SandboxLease } from '../../../marketplace/machine/entities/sandbox-lease.entity';
import { Organization } from '../../../organization/tenant/entities/organization.entity';
import { SandboxPlacement } from '../../../sandbox/instance/entities/sandbox-placement.entity';
import { SandboxClass } from '../../../sandbox/instance/enums/sandbox-class.enum';
import { Machine } from '../../../sandbox/machine/entities/machine.entity';
import { GpuType } from '../../../sandbox/machine/enums/gpu-type.enum';
import { UsageMode } from '../constants/usage-lifecycle.constants';

@Entity({ tableName: 'sandbox_usage_periods' })
@Index({
	name: 'idx_sandbox_usage_periods_sandbox_end',
	properties: ['sandboxId', 'endAt'],
})
@Index({
	name: 'sandbox_usage_periods_one_open_period_per_sandbox_idx',
	expression:
		'create unique index "sandbox_usage_periods_one_open_period_per_sandbox_idx" on "sandbox_usage_periods" ("sandboxId") where "endAt" is null',
})
@Index({
	name: 'IDX_sandbox_usage_periods_customer_open',
	expression:
		'create index "IDX_sandbox_usage_periods_customer_open" on "sandbox_usage_periods" ("customerOrganizationId") where "endAt" is null',
})
@Index({
	name: 'IDX_sandbox_usage_periods_host_open',
	expression:
		'create index "IDX_sandbox_usage_periods_host_open" on "sandbox_usage_periods" ("hostOrganizationId") where "endAt" is null',
})
@Check({
	name: 'CHK_sandbox_usage_periods_assignment_generation',
	expression: '"assignmentGeneration" > 0',
})
@Check({
	name: 'CHK_sandbox_usage_periods_mode',
	expression: `"mode" in (${sqlValueList(UsageMode)})`,
})
export class SandboxUsagePeriod {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'sandboxId',
	})
	sandboxId: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'customerOrganizationId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_usage_periods_customer_organization',
	})
	customerOrganizationId: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'hostOrganizationId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_usage_periods_host_organization',
	})
	hostOrganizationId: string;

	@ManyToOne({
		entity: () => SandboxPlacement,
		mapToPk: true,
		joinColumn: 'placementId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_usage_periods_placement',
	})
	placementId: string;

	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_usage_periods_machine',
	})
	machineId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'assignmentGeneration',
	})
	assignmentGeneration: number;

	@ManyToOne({
		entity: () => SandboxLease,
		mapToPk: true,
		joinColumn: 'leaseId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_usage_periods_lease',
	})
	leaseId: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'mode',
	})
	mode: UsageMode;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'startAt',
	})
	startAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'endAt',
		nullable: true,
	})
	endAt: Date | null;

	@Property({
		type: 'number',
		columnType: 'double precision',
	})
	cpu: number;

	@Property({
		type: 'number',
		columnType: 'double precision',
	})
	gpu: number;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'gpu_type',
		nullable: true,
	})
	gpuType: GpuType | null;

	@Property({
		type: 'number',
		columnType: 'double precision',
	})
	mem: number;

	@Property({
		type: 'number',
		columnType: 'double precision',
	})
	disk: number;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'sandboxClass',
		default: SandboxClass.LINUX_VM,
	})
	sandboxClass: SandboxClass = SandboxClass.LINUX_VM;

	static fromUsagePeriod(usagePeriod: SandboxUsagePeriod): SandboxUsagePeriod {
		const usagePeriodEntity = new SandboxUsagePeriod();
		usagePeriodEntity.sandboxId = usagePeriod.sandboxId;
		usagePeriodEntity.customerOrganizationId =
			usagePeriod.customerOrganizationId;
		usagePeriodEntity.hostOrganizationId = usagePeriod.hostOrganizationId;
		usagePeriodEntity.placementId = usagePeriod.placementId;
		usagePeriodEntity.machineId = usagePeriod.machineId;
		usagePeriodEntity.assignmentGeneration = usagePeriod.assignmentGeneration;
		usagePeriodEntity.leaseId = usagePeriod.leaseId;
		usagePeriodEntity.mode = usagePeriod.mode;
		usagePeriodEntity.startAt = usagePeriod.startAt;
		usagePeriodEntity.endAt = usagePeriod.endAt;
		usagePeriodEntity.cpu = usagePeriod.cpu;
		usagePeriodEntity.gpu = usagePeriod.gpu;
		usagePeriodEntity.gpuType = usagePeriod.gpuType;
		usagePeriodEntity.mem = usagePeriod.mem;
		usagePeriodEntity.disk = usagePeriod.disk;
		usagePeriodEntity.sandboxClass = usagePeriod.sandboxClass;
		return usagePeriodEntity;
	}
}
