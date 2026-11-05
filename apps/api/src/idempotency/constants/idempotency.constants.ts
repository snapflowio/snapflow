/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const IDEMPOTENCY_STATE = {
	COMPLETED: 'completed',
	FAILED_TERMINAL: 'failed_terminal',
} as const;
export type IdempotencyState =
	(typeof IDEMPOTENCY_STATE)[keyof typeof IDEMPOTENCY_STATE];

export const IDEMPOTENCY_LIMITS = {
	KEY_MIN_LENGTH: 16,
	KEY_MAX_LENGTH: 128,
	METHOD_MAX_LENGTH: 16,
	ROUTE_TEMPLATE_MAX_LENGTH: 512,
	RESOURCE_TYPE_MAX_LENGTH: 128,
	SAFE_DETAIL_MAX_LENGTH: 512,
} as const;

export const IDEMPOTENCY_FINGERPRINT_SCHEMA_VERSION = 1;
export const IDEMPOTENCY_RECORD_SCHEMA_VERSION = 1;
export const IDEMPOTENCY_ADVISORY_LOCK_SEED = 7_341_928;

export const IDEMPOTENCY_HMAC_DOMAIN = {
	KEY: 'snapflow.api.idempotency.key.v1',
	REQUEST: 'snapflow.api.idempotency.request.v1',
} as const;

export const IDEMPOTENCY_PROBLEM_CODE = {
	KEY_REQUIRED: 'idempotency_key_required',
	KEY_INVALID: 'idempotency_key_invalid',
	KEY_REUSED: 'idempotency_key_reused',
	REQUEST_IN_PROGRESS: 'idempotency_request_in_progress',
	RESPONSE_CORRUPTED: 'idempotency_response_corrupted',
} as const;

export const IDEMPOTENCY_RESPONSE_HEADER_ALLOWLIST = [
	'location',
	'etag',
] as const;

export const IDEMPOTENCY_RETRY_AFTER_SECONDS = 2;
