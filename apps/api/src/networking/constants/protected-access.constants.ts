/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const PROTECTED_ACCESS = {
	grantTokenBytes: 32,
	grantLifetimeSeconds: 60,
	backendActivationTimeoutMilliseconds: 30_000,
	backendActivationRecheckMilliseconds: 5_000,
	minimumSessionLifetimeSeconds: 60,
	defaultSessionLifetimeSeconds: 60 * 60,
	maximumSessionLifetimeSeconds: 8 * 60 * 60,
	absoluteSessionLifetimeSeconds: 8 * 60 * 60,
	sessionRenewalDivisor: 2,
	redisKeyPrefix: 'networking:protected-access-grant:',
	redeemedGrantRedisKeyPrefix: 'networking:protected-access-redeemed-grant:',
	sessionRedisKeyPrefix: 'networking:protected-access-session:',
	grantQueryParameter: 'SNAPFLOW_ACCESS_GRANT',
	backendQueryParameter: 'SNAPFLOW_ACCESS_ENDPOINT',
	maximumGrantLength: 96,
} as const;
