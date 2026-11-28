/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { client } from '@snapflow/api-client/client.gen';
import { ORGANIZATION_CONTEXT_HEADER } from '@snapflow/organization-access';
import { type Fetcher, withAdminMfaStepUp } from '#lib/api/admin/mfa-fetch.ts';
import { reauthentication } from '#lib/api/auth/reauthentication.svelte.ts';
import { ClientErrorCode } from '#lib/api/errors/error-catalog.ts';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';
import { API_BASE_PATH } from '#lib/config/service-paths.ts';
import {
	activeOrganizationContext,
	isOrganizationContextChanged,
} from './organization-context.ts';

const REQUEST_TIMEOUT_MILLISECONDS = 30_000;
const MILLISECONDS_PER_MINUTE = 60_000;
const FILE_TRANSFER_TIMEOUT_MINUTES = 30;
const FILE_TRANSFER_TIMEOUT_MILLISECONDS =
	FILE_TRANSFER_TIMEOUT_MINUTES * MILLISECONDS_PER_MINUTE;
const UNAUTHORIZED_STATUS = 401;
const BAD_GATEWAY_STATUS = 502;
const GATEWAY_TIMEOUT_STATUS = 504;
const GATEWAY_FAILURE_STATUSES: ReadonlySet<number> = new Set([
	BAD_GATEWAY_STATUS,
	GATEWAY_TIMEOUT_STATUS,
]);
const TIMEOUT_ERROR_NAME = 'TimeoutError';

const createIdempotencyKey = (): string => crypto.randomUUID();

export function idempotencyHeaders() {
	return { 'Idempotency-Key': createIdempotencyKey() };
}

export function ifMatchHeaders(version: number) {
	return { 'if-match': `"${version}"` };
}

function fetchWithDeadline(timeoutMilliseconds: number): Fetcher {
	return (input, init) => {
		const request = new Request(input, init);
		return fetch(request, {
			signal: AbortSignal.any([
				request.signal,
				AbortSignal.timeout(timeoutMilliseconds),
			]),
		});
	};
}

export const fetchWithTimeout = fetchWithDeadline(REQUEST_TIMEOUT_MILLISECONDS);

export const fetchWithTransferTimeout = fetchWithDeadline(
	FILE_TRANSFER_TIMEOUT_MILLISECONDS
);

export function toSnapflowError(
	error: unknown,
	response: Response | undefined,
	retryableStatus: (status: number | undefined) => boolean = () => false
): SnapflowError {
	if (error instanceof DOMException && error.name === TIMEOUT_ERROR_NAME) {
		return new SnapflowError('', {
			code: ClientErrorCode.TIMEOUT,
			cause: error,
			retryable: true,
		});
	}

	const normalized = SnapflowError.fromUnknown(error);
	return new SnapflowError(normalized.message, {
		cause: error,
		code: normalized.code,
		details: normalized.details,
		retryable: normalized.retryable || retryableStatus(response?.status),
		status: response?.status ?? null,
	});
}

function isApiUnreachable(
	error: unknown,
	response: Response | undefined
): boolean {
	if (response === undefined) return error instanceof TypeError;
	return GATEWAY_FAILURE_STATUSES.has(response.status);
}

export function configureApiClient(onSessionRejected: () => void): void {
	client.setConfig({
		baseUrl: API_BASE_PATH,
		credentials: 'include',
		fetch: withAdminMfaStepUp(fetchWithTimeout),
	});
	client.interceptors.request.use((request) => {
		const organizationId = activeOrganizationContext();
		if (organizationId) {
			request.headers.set(ORGANIZATION_CONTEXT_HEADER, organizationId);
		}
		return request;
	});
	client.interceptors.error.use((error, response) => {
		const snapflowError = isApiUnreachable(error, response)
			? SnapflowError.unreachable({
					cause: error,
					status: response?.status ?? null,
				})
			: toSnapflowError(error, response);
		if (
			response?.status === UNAUTHORIZED_STATUS ||
			isOrganizationContextChanged(snapflowError)
		) {
			onSessionRejected();
		}
		reauthentication.requestIfNotFresh(snapflowError);
		return snapflowError;
	});
}
