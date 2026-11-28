/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum CommonErrorCode {
	BAD_REQUEST = 'bad_request',
	VALIDATION_FAILED = 'validation_failed',
	INVALID_JSON = 'invalid_json',
	CURSOR_INVALID = 'cursor_invalid',
	RESOURCE_VERSION_REQUIRED = 'resource_version_required',
	RESOURCE_VERSION_INVALID = 'resource_version_invalid',
	UNAUTHORIZED = 'unauthorized',
	PAYMENT_REQUIRED = 'payment_required',
	FORBIDDEN = 'forbidden',
	ACCESS_DENIED = 'access_denied',
	INVALID_AUTHENTICATION_CONTEXT = 'invalid_authentication_context',
	NOT_FOUND = 'not_found',
	CONFLICT = 'conflict',
	RESOURCE_MODIFIED = 'resource_modified',
	OPERATION_IN_PROGRESS = 'operation_in_progress',
	GONE = 'gone',
	PAYLOAD_TOO_LARGE = 'payload_too_large',
	UNPROCESSABLE = 'unprocessable',
	RATE_LIMITED = 'rate_limited',
	INTERNAL_ERROR = 'internal_error',
	SERVICE_UNAVAILABLE = 'service_unavailable',
	GATEWAY_TIMEOUT = 'gateway_timeout',
	REQUEST_FAILED = 'request_failed',
}
