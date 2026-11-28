/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Sandbox } from '@snapflow/api-client';
import {
	type Client,
	createClient,
	createConfig,
} from '@snapflow/toolbox-api-client/client';
import {
	fetchWithTimeout,
	toSnapflowError,
} from '#lib/api/client/api-client.ts';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';

const SERVER_ERROR_STATUS = 500;
const TOOLBOX_QUERY_MAXIMUM_RETRIES = 3;

export interface SandboxToolboxClient {
	client: Client;
	sandboxId: string;
}

export interface SandboxToolboxClientArgs {
	enabled: boolean;
	sandbox: Sandbox;
}

export function createToolboxClient(origin: string): Client {
	const client = createClient(
		createConfig({
			baseUrl: origin,
			credentials: 'include',
			fetch: fetchWithTimeout,
			throwOnError: true,
		})
	);
	client.interceptors.error.use((error, response) =>
		toSnapflowError(
			error,
			response,
			(status) => status === undefined || status >= SERVER_ERROR_STATUS
		)
	);
	return client;
}

export function shouldRetryToolboxRequest(
	failureCount: number,
	error: Error
): boolean {
	return (
		error instanceof SnapflowError &&
		error.retryable &&
		failureCount < TOOLBOX_QUERY_MAXIMUM_RETRIES
	);
}
