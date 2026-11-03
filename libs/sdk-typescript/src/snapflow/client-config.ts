/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Client, createClient } from '@snapflow/api-client/client';
import { toSnapflowError } from '../errors/error-mapping.js';
import { SnapflowAuthenticationError } from '../errors/snapflow-error.js';
import type { SnapflowConfig } from '../snapflow.types.js';
import { RUNTIME, Runtime, readEnvironmentVariable } from '../utils/runtime.js';

const DEFAULT_API_URL = 'https://snapflow.io/api';
const SDK_SOURCE_LABEL = 'sdk-typescript';
const API_KEY_VARIABLE = 'SNAPFLOW_API_KEY';
const API_URL_VARIABLE = 'SNAPFLOW_API_URL';
export const SDK_VERSION = '0.0.0-dev';
export const SDK_VERSION_HEADER = 'X-Snapflow-SDK-Version';

export interface ResolvedClientConfig {
	apiKey: string;
	apiUrl: string;
}

export function resolveClientConfig(
	config?: SnapflowConfig
): ResolvedClientConfig {
	let apiKey = config?.apiKey;
	let apiUrl = config?.apiUrl;

	if (!(apiKey && apiUrl) && RUNTIME !== Runtime.BROWSER) {
		apiKey = apiKey || readEnvironmentVariable(API_KEY_VARIABLE);
		apiUrl = apiUrl || readEnvironmentVariable(API_URL_VARIABLE);
	}

	if (!apiKey) {
		throw new SnapflowAuthenticationError(
			'Authentication credentials not found. Set SNAPFLOW_API_KEY or provide apiKey in SnapflowConfig.'
		);
	}

	return { apiKey, apiUrl: apiUrl || DEFAULT_API_URL };
}

export function createApiClient(
	{ apiKey, apiUrl }: ResolvedClientConfig,
	sdkVersion: string
): Client {
	const client = createClient({
		baseUrl: apiUrl,
		throwOnError: true,
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'X-Snapflow-Source': SDK_SOURCE_LABEL,
			[SDK_VERSION_HEADER]: sdkVersion,
			'User-Agent': `${SDK_SOURCE_LABEL}/${sdkVersion}`,
		},
	});
	client.interceptors.error.use(toSnapflowError);
	return client;
}
