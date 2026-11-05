/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export type SandboxUsageOverviewInternalDto = {
	currentCpuUsage: number;
	currentMemoryUsage: number;
	currentDiskUsage: number;
	currentGpuUsage: number;
};

export type PendingSandboxUsageOverviewInternalDto = {
	pendingCpuUsage: number | null;
	pendingMemoryUsage: number | null;
	pendingDiskUsage: number | null;
	pendingGpuUsage: number | null;
};

export type SandboxUsageOverviewWithPendingInternalDto =
	SandboxUsageOverviewInternalDto & PendingSandboxUsageOverviewInternalDto;
