/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const PLATFORM_PROBLEM_CODE = {
	PUBLIC_INGRESS_DISABLED: 'public_ingress_disabled',
	IDEMPOTENCY_KEY_REQUIRED: 'idempotency_key_required',
	IDEMPOTENCY_KEY_REUSED: 'idempotency_key_reused',
	IDEMPOTENCY_REQUEST_IN_PROGRESS: 'idempotency_request_in_progress',
	SECRET_NOT_FOUND: 'secret_not_found',
	SECRET_VERSION_REVOKED: 'secret_version_revoked',
	MACHINE_NOT_QUALIFIED: 'machine_not_qualified',
} as const;
