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
	Check,
	Entity,
	ManyToOne,
	Property,
} from '@mikro-orm/decorators/legacy';
import { ARCHIVE_AFTER_STOPPED_DAYS } from '../../settings/constants/settings.constants';
import { SNAPSHOT_DEACTIVATION_TIMEOUT_MINUTES } from '../constants/organization-limits.constants';
import { Organization } from './organization.entity';

export type OrganizationLimitsDefaults = Pick<
	OrganizationLimits,
	| 'maxCpuPerSandbox'
	| 'maxMemoryPerSandbox'
	| 'maxDiskPerSandbox'
	| 'sandboxLimitedNetworkEgress'
>;

@Entity({ tableName: 'organization_limits' })
@Check({
	name: 'CHK_organization_limits_archive_after_stopped_days',
	expression: `"archiveAfterStoppedDays" is null or "archiveAfterStoppedDays" between ${ARCHIVE_AFTER_STOPPED_DAYS.MINIMUM} and ${ARCHIVE_AFTER_STOPPED_DAYS.MAXIMUM}`,
})
export class OrganizationLimits {
	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		primary: true,
		joinColumn: 'organizationId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		foreignKeyName: 'organization_limits_organizationId_fk',
	})
	organizationId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'max_cpu_per_sandbox',
	})
	maxCpuPerSandbox: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'max_memory_per_sandbox',
	})
	maxMemoryPerSandbox: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'max_disk_per_sandbox',
	})
	maxDiskPerSandbox: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'storage_cap_gib',
		nullable: true,
	})
	storageCapGib: number | null = null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'archiveAfterStoppedDays',
		nullable: true,
	})
	archiveAfterStoppedDays: number | null = null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'authenticated_rate_limit',
		nullable: true,
	})
	authenticatedRateLimit: number | null = null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'sandbox_create_rate_limit',
		nullable: true,
	})
	sandboxCreateRateLimit: number | null = null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'sandbox_lifecycle_rate_limit',
		nullable: true,
	})
	sandboxLifecycleRateLimit: number | null = null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'authenticated_rate_limit_ttl_seconds',
		nullable: true,
	})
	authenticatedRateLimitTtlSeconds: number | null = null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'sandbox_create_rate_limit_ttl_seconds',
		nullable: true,
	})
	sandboxCreateRateLimitTtlSeconds: number | null = null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'sandbox_lifecycle_rate_limit_ttl_seconds',
		nullable: true,
	})
	sandboxLifecycleRateLimitTtlSeconds: number | null = null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'snapshot_deactivation_timeout_minutes',
		default: SNAPSHOT_DEACTIVATION_TIMEOUT_MINUTES,
	})
	snapshotDeactivationTimeoutMinutes: number =
		SNAPSHOT_DEACTIVATION_TIMEOUT_MINUTES;

	@Property({
		type: 'boolean',
		fieldName: 'sandboxLimitedNetworkEgress',
	})
	sandboxLimitedNetworkEgress: boolean;

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

	[PrimaryKeyProp]?: 'organizationId';

	constructor(organizationId: string, defaults: OrganizationLimitsDefaults) {
		this.organizationId = organizationId;
		this.maxCpuPerSandbox = defaults.maxCpuPerSandbox;
		this.maxMemoryPerSandbox = defaults.maxMemoryPerSandbox;
		this.maxDiskPerSandbox = defaults.maxDiskPerSandbox;
		this.sandboxLimitedNetworkEgress = defaults.sandboxLimitedNetworkEgress;
	}
}
