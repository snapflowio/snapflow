/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { PrimaryKeyProp } from '@mikro-orm/core';
import {
	Entity,
	ManyToOne,
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import { GpuType } from '../../machine/enums/gpu-type.enum';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { Organization } from './organization.entity';

const DEFAULT_MAX_CPU_PER_GPU_SANDBOX = 16;
const DEFAULT_MAX_MEMORY_PER_GPU_SANDBOX = 192;
const DEFAULT_MAX_DISK_PER_GPU_SANDBOX = 512;

@Entity({ tableName: 'organization_quota' })
export class OrganizationQuota {
	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		primary: true,
		joinColumn: 'organizationId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		foreignKeyName: 'organization_quota_organizationId_fk',
	})
	organizationId: string;

	@PrimaryKey({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'sandboxClass',
	})
	sandboxClass: SandboxClass;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'total_cpu_quota',
	})
	totalCpuQuota: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'total_memory_quota',
	})
	totalMemoryQuota: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'total_disk_quota',
	})
	totalDiskQuota: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'total_gpu_quota',
		default: 0,
	})
	totalGpuQuota: number;

	@Property({
		type: 'string[]',
		columnType: 'text[]',
		fieldName: 'allowed_gpu_types',
		nullable: true,
	})
	allowedGpuTypes: GpuType[] | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'max_cpu_per_sandbox',
		nullable: true,
	})
	maxCpuPerSandbox: number | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'max_memory_per_sandbox',
		nullable: true,
	})
	maxMemoryPerSandbox: number | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'max_disk_per_sandbox',
		nullable: true,
	})
	maxDiskPerSandbox: number | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'max_disk_per_non_ephemeral_sandbox',
		nullable: true,
	})
	maxDiskPerNonEphemeralSandbox: number | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'max_cpu_per_gpu_sandbox',
		nullable: true,
		default: DEFAULT_MAX_CPU_PER_GPU_SANDBOX,
	})
	maxCpuPerGpuSandbox: number | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'max_memory_per_gpu_sandbox',
		nullable: true,
		default: DEFAULT_MAX_MEMORY_PER_GPU_SANDBOX,
	})
	maxMemoryPerGpuSandbox: number | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'max_disk_per_gpu_sandbox',
		nullable: true,
		default: DEFAULT_MAX_DISK_PER_GPU_SANDBOX,
	})
	maxDiskPerGpuSandbox: number | null;

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

	[PrimaryKeyProp]?: ['organizationId', 'sandboxClass'];

	constructor(params?: {
		organizationId: string;
		sandboxClass: SandboxClass;
		totalCpuQuota: number;
		totalMemoryQuota: number;
		totalDiskQuota: number;
		totalGpuQuota?: number;
		allowedGpuTypes?: GpuType[] | null;
		maxCpuPerSandbox?: number | null;
		maxMemoryPerSandbox?: number | null;
		maxDiskPerSandbox?: number | null;
		maxDiskPerNonEphemeralSandbox?: number | null;
		maxCpuPerGpuSandbox?: number | null;
		maxMemoryPerGpuSandbox?: number | null;
		maxDiskPerGpuSandbox?: number | null;
	}) {
		if (!params) return;

		this.organizationId = params.organizationId;
		this.sandboxClass = params.sandboxClass;
		this.totalCpuQuota = params.totalCpuQuota;
		this.totalMemoryQuota = params.totalMemoryQuota;
		this.totalDiskQuota = params.totalDiskQuota;
		this.totalGpuQuota = params.totalGpuQuota ?? 0;
		this.allowedGpuTypes = params.allowedGpuTypes ?? null;
		this.maxCpuPerSandbox = params.maxCpuPerSandbox ?? null;
		this.maxMemoryPerSandbox = params.maxMemoryPerSandbox ?? null;
		this.maxDiskPerSandbox = params.maxDiskPerSandbox ?? null;
		this.maxDiskPerNonEphemeralSandbox =
			params.maxDiskPerNonEphemeralSandbox ?? null;
		this.maxCpuPerGpuSandbox =
			params.maxCpuPerGpuSandbox ?? DEFAULT_MAX_CPU_PER_GPU_SANDBOX;
		this.maxMemoryPerGpuSandbox =
			params.maxMemoryPerGpuSandbox ?? DEFAULT_MAX_MEMORY_PER_GPU_SANDBOX;
		this.maxDiskPerGpuSandbox =
			params.maxDiskPerGpuSandbox ?? DEFAULT_MAX_DISK_PER_GPU_SANDBOX;
	}
}
