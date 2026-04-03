/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

/**
 * CPU resource limits (in cores)
 */
export const CPU_LIMITS = {
	MIN: 1,
	MAX: 32,
} as const;

/**
 * Memory resource limits (in MB)
 */
export const MEMORY_LIMITS = {
	MIN: 256,
	MAX: 65536,
} as const;

/**
 * GPU resource limits (in units)
 */
export const GPU_LIMITS = {
	MIN: 0,
	MAX: 8,
} as const;

/**
 * Disk storage limits (in GB)
 */
export const DISK_LIMITS = {
	MIN: 1,
	MAX: 1000,
} as const;

/**
 * Duration limits (in seconds)
 */
export const DURATION_LIMITS = {
	MIN: 1,
	MAX: 86400 * 30, // 30 days
} as const;
