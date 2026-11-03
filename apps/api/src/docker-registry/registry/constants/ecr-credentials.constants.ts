/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const ECR_REGISTRY_ROLE_FORBIDDEN = 'ECR_REGISTRY_ROLE_FORBIDDEN';

export const ECR_CREDENTIALS = {
	HOST_PATTERN: /^\d{12}\.dkr\.ecr\.(?<region>[a-z0-9-]+)\.amazonaws\.com$/,
	ROLE_ARN_PATTERN: /^arn:aws:iam::(?<accountId>\d{12}):role\/.+$/,
	TOKEN_CACHE_PREFIX: 'ecr:token',
	TOKEN_SEPARATOR: ':',
	SESSION_NAME_PREFIX: 'snapflow-',
	SESSION_NAME_SUFFIX: '-pull',
	REFRESH_BUFFER_SECONDS: 30 * 60,
	FAILURE_CACHE_SECONDS: 60,
} as const;
