/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { OrganizationQuotaDto } from '../../../organization/tenant/dto/organization-quota.dto';
import type { OrganizationLimits } from '../../../organization/tenant/entities/organization-limits.entity';
import type { SandboxResourceAmounts } from '../../../organization/tenant/utils/organization-usage.util';
import type { SandboxClass } from '../enums/sandbox-class.enum';

export interface SandboxQuotaRequest {
	organizationLimits: OrganizationLimits;
	sandboxClass: SandboxClass;
	usage: SandboxResourceAmounts;
	ephemeral: boolean;
	ownMachinesOnly: boolean;
	excludeSandboxId?: string;
	quota?: OrganizationQuotaDto | null;
	gpuEnabled?: boolean;
}

export interface PendingQuotaReservation {
	pendingCpuIncremented: boolean;
	pendingMemoryIncremented: boolean;
	pendingDiskIncremented: boolean;
	pendingGpuIncremented: boolean;
}
