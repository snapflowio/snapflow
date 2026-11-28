/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const DashboardMode = {
	Deploy: 'deploy',
	Host: 'host',
} as const;

export type DashboardMode = (typeof DashboardMode)[keyof typeof DashboardMode];

export const DASHBOARD_MODE_STORAGE_KEY = 'dashboard-mode';

const DASHBOARD_MODES: ReadonlySet<string> = new Set(
	Object.values(DashboardMode)
);

export function isDashboardMode(value: string): value is DashboardMode {
	return DASHBOARD_MODES.has(value);
}
