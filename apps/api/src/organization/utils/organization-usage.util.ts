/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';

export const SANDBOX_QUOTA_RESOURCES = [
	'cpu',
	'memory',
	'disk',
	'gpu',
] as const;

export type SandboxQuotaResource = (typeof SANDBOX_QUOTA_RESOURCES)[number];
export type OrganizationCountQuotaType = 'snapshot_count' | 'volume_count';
export type OrganizationUsageQuotaType =
	| SandboxQuotaResource
	| OrganizationCountQuotaType;
export type OrganizationUsageResourceType = 'sandbox' | 'snapshot' | 'volume';
export type OrganizationCountResourceType = Exclude<
	OrganizationUsageResourceType,
	'sandbox'
>;

export interface SandboxUsageScope {
	organizationId: string;
	sandboxClass: SandboxClass;
}

export type SandboxResourceAmounts = Record<SandboxQuotaResource, number>;
