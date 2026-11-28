/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const REFRESH_INTERVALS = [
	{ label: 'Off', milliseconds: false, value: 'off' },
	{ label: 'Every 5s', milliseconds: 5_000, value: '5000' },
	{ label: 'Every 10s', milliseconds: 10_000, value: '10000' },
	{ label: 'Every 30s', milliseconds: 30_000, value: '30000' },
	{ label: 'Every 1m', milliseconds: 60_000, value: '60000' },
] as const;

export type ResourceRefreshInterval =
	(typeof REFRESH_INTERVALS)[number]['milliseconds'];
