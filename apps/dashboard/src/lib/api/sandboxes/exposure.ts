/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	createProtectedAccessGrant,
	ensurePreviewExposure,
	type ProtectedAccessGrantDto,
	requestSystemExposure,
	type Sandbox,
	type SystemExposureService,
} from '@snapflow/api-client';
import {
	fetchWithTimeout,
	idempotencyHeaders,
} from '#lib/api/client/api-client.ts';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';

const SECONDS_PER_MINUTE = 60;
const SANDBOX_ACCESS_SESSION_DURATION_MINUTES = 60;
const REDEEMED_GRANT_RESPONSE_TYPE: ResponseType = 'opaqueredirect';

const SANDBOX_ACCESS_SESSION_DURATION_SECONDS =
	SANDBOX_ACCESS_SESSION_DURATION_MINUTES * SECONDS_PER_MINUTE;

type SandboxAccessTarget = Pick<Sandbox, 'id'>;

export async function requestSandboxSystemAccess(
	sandbox: SandboxAccessTarget,
	service: SystemExposureService
): Promise<ProtectedAccessGrantDto> {
	const exposure = await requestSystemExposure({
		path: { sandboxId: sandbox.id, service },
		body: { durationSeconds: SANDBOX_ACCESS_SESSION_DURATION_SECONDS },
		headers: idempotencyHeaders(),
	});
	return grantSandboxExposureAccess(sandbox, exposure.data.id);
}

export async function requestSandboxPortAccess(
	sandbox: SandboxAccessTarget,
	port: number
): Promise<ProtectedAccessGrantDto> {
	const exposure = await ensurePreviewExposure({
		path: { sandboxId: sandbox.id, port },
	});
	return grantSandboxExposureAccess(sandbox, exposure.data.id);
}

async function grantSandboxExposureAccess(
	sandbox: SandboxAccessTarget,
	exposureId: string
): Promise<ProtectedAccessGrantDto> {
	return (
		await createProtectedAccessGrant({
			path: { sandboxId: sandbox.id, exposureId },
			body: { sessionLifetimeSeconds: SANDBOX_ACCESS_SESSION_DURATION_SECONDS },
			headers: idempotencyHeaders(),
		})
	).data;
}

export async function redeemSandboxAccess(accessUrl: string): Promise<string> {
	const sessionUrl = new URL(accessUrl);
	const response = await fetchWithTimeout(accessUrl, {
		credentials: 'include',
		redirect: 'manual',
	}).catch((error: unknown) => {
		throw edgeUnreachableError(sessionUrl, error);
	});
	if (response.type !== REDEEMED_GRANT_RESPONSE_TYPE) {
		throw new SnapflowError('The sandbox access session could not be opened.', {
			retryable: true,
			status: response.status,
		});
	}
	sessionUrl.search = '';
	return sessionUrl.toString();
}

function edgeUnreachableError(url: URL, error: unknown): unknown {
	if (!(error instanceof TypeError)) return error;
	return new SnapflowError(
		`Your browser could not reach ${url.host}. Check that the sandbox edge is running and that this browser trusts its TLS certificate.`,
		{ cause: error, retryable: true }
	);
}
