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
import { SandboxUsagePeriod } from './sandbox-usage-period.entity';

@Entity({ tableName: 'sandbox_usage_periods_archive' })
@Check({
	name: 'CHK_sandbox_usage_periods_archive_assignment_generation',
	expression: '"assignmentGeneration" > 0',
})
@Check({
	name: 'CHK_sandbox_usage_periods_archive_mode',
	expression: `"mode" in (${sqlValueList(UsageMode)})`,
})
export class SandboxUsagePeriodArchive {
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
		foreignKeyName: 'FK_sandbox_usage_periods_archive_customer_organization',
	})
	customerOrganizationId: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'hostOrganizationId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_usage_periods_archive_host_organization',
	})
	hostOrganizationId: string;

	@ManyToOne({
		entity: () => SandboxPlacement,
		mapToPk: true,
		joinColumn: 'placementId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_usage_periods_archive_placement',
	})
	placementId: string;

	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_usage_periods_archive_machine',
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
		foreignKeyName: 'FK_sandbox_usage_periods_archive_lease',
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
	})
	endAt: Date;

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

	static fromUsagePeriod(
		usagePeriod: SandboxUsagePeriod
	): SandboxUsagePeriodArchive {
		if (!usagePeriod.endAt) {
			throw new Error('Cannot archive an open sandbox usage period');
		}

		const usagePeriodEntity = new SandboxUsagePeriodArchive();
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
