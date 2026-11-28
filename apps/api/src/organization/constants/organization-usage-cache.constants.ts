/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const ORGANIZATION_USAGE_CACHE = {
	TTL_SECONDS: 60,
	MAX_AGE_MILLISECONDS: 60 * 60 * 1000,
	LOCK_TTL_SECONDS: 60,
} as const;

export const QUOTA_RESERVATION_CACHE_RETRIES = 2;

export const QUOTA_RESERVATION_STATUS = {
	cacheMiss: -1,
	rejected: 0,
	accepted: 1,
} as const;
