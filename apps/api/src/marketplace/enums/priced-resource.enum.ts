/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

// The resources a price card prices, each by its own rate.
export const PricedResource = {
	VCPU_HOUR: 'vcpu_hour',
	MEMORY_GIB_HOUR: 'memory_gib_hour',
	GPU_HOUR: 'gpu_hour',
	DISK_GIB_MONTH: 'disk_gib_month',
	STOPPED_DISK_GIB_MONTH: 'stopped_disk_gib_month',
	EGRESS_GIB: 'egress_gib',
} as const;

export type PricedResource =
	(typeof PricedResource)[keyof typeof PricedResource];
