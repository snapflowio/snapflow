/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const ORGANIZATION_SUSPENSION = {
	RESOURCE_BATCH_SIZE: 100,
	RESOURCE_LOOKBACK_DAYS: 7,
	JOB_LOCK_TTL_SECONDS: 60,
	STOP_SANDBOXES_LOCK_KEY: 'stop-suspended-organization-sandboxes',
	DEACTIVATE_SNAPSHOTS_LOCK_KEY: 'deactivate-suspended-organization-snapshots',
} as const;

export const ORGANIZATION_SUSPENSION_REASON = {
	EMAIL_UNVERIFIED: 'Please verify your email address',
	OWNER_BANNED: 'The organization owner account is suspended',
} as const;
