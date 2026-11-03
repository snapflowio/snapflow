/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const SECRET_LIMITS = {
	NAME_MIN_LENGTH: 1,
	NAME_MAX_LENGTH: 128,
	DESCRIPTION_MAX_LENGTH: 1_024,
	VALUE_MAX_BYTES: 64 * 1_024,
	BINDINGS_PER_SANDBOX: 256,
	ENVIRONMENT_NAME_MAX_LENGTH: 128,
} as const;

export const SECRET_ENVIRONMENT_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const SECRET_RESOURCE_VERSION_INITIAL = 1;

export const SECRET_PROBLEM_CODE = {
	NOT_FOUND: 'secret_not_found',
	VERSION_NOT_FOUND: 'secret_version_not_found',
	VERSION_REVOKED: 'secret_version_revoked',
	CURRENT_VERSION_REVOKE_DENIED: 'secret_current_version_revoke_denied',
	IN_USE: 'secret_in_use',
	VERSION_CONFLICT: 'secret_resource_version_conflict',
	DUPLICATE_ENVIRONMENT_NAME: 'secret_environment_name_duplicate',
} as const;

export const SECRET_DELIVERY_OUTCOME = {
	DELIVERED: 'delivered',
	REJECTED_REVOKED: 'rejected_revoked',
	REJECTED_MISSING: 'rejected_missing',
} as const;
export type SecretDeliveryOutcome =
	(typeof SECRET_DELIVERY_OUTCOME)[keyof typeof SECRET_DELIVERY_OUTCOME];
