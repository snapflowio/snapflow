/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const MACHINE_ALTERNATIVE_LIMIT = 5;

export const SANDBOX_LEASE_JOB = {
	RENEWAL: 'renew-sandbox-leases',
	PINNED_START_WAIT: 'retry-pinned-sandbox-starts',
} as const;

export const SANDBOX_LEASE_BATCH_SIZE = 100;
