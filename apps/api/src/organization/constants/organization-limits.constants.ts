/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const SNAPSHOT_DEACTIVATION_TIMEOUT_MINUTES = 20_160;

export const ORGANIZATION_RATE_LIMITS_CACHE = {
	keyPrefix: 'organization:rate-limits:',
	ttlSeconds: 60,
} as const;

export const organizationRateLimitsCacheKey = (
	organizationId: string
): string => `${ORGANIZATION_RATE_LIMITS_CACHE.keyPrefix}${organizationId}`;

export const STORAGE_CAP_GIB_MINIMUM = 0;

export const ORGANIZATION_LIMIT_MINIMUM = 1;

export const ORGANIZATION_QUOTA_MINIMUM = 0;

export const StorageErrorCode = {
	STORAGE_CAP_REACHED: 'snapflow_storage_cap_reached',
} as const;

export type StorageErrorCode =
	(typeof StorageErrorCode)[keyof typeof StorageErrorCode];
