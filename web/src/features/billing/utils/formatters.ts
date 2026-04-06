/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export function fmtDur(s: number): string {
	if (s <= 0) {
		return '0s';
	}

	if (s < 3600) {
		return `${(s / 60).toFixed(0)}m`;
	}

	if (s < 86400) {
		return `${(s / 3600).toFixed(1)}h`;
	}

	return `${(s / 86400).toFixed(1)}d`;
}

export function fmtLimit(v: number): string {
	return v === -1 ? 'Unlimited' : String(v);
}

export function fmtLife(s: number): string {
	if (s === -1) {
		return 'Unlimited';
	}

	if (s < 3600) {
		return `${s / 60}m`;
	}

	if (s < 86400) {
		return `${s / 3600}h`;
	}

	return `${s / 86400}d`;
}

export function fmtMem(mb: number): string {
	if (mb === -1) {
		return 'Custom';
	}

	return mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`;
}
