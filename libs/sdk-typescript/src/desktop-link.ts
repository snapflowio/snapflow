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

import {
	createProtectedAccessGrant,
	type ProtectedAccessGrantDto,
	requestSystemExposure,
	SystemExposureService,
} from '@snapflow/api-client';
import type { Client } from '@snapflow/api-client/client';
import {
	type IdempotentOperationOptions,
	resolveIdempotencyKey,
} from './utils/idempotency.js';

const DESKTOP_EXPOSURE_LEASE_SECONDS = 300;

export interface DesktopLinkOptions extends IdempotentOperationOptions {
	sessionLifetimeSeconds?: number;
}

export type DesktopLink = ProtectedAccessGrantDto;

export type DesktopLinkProvider = (
	options?: DesktopLinkOptions
) => Promise<DesktopLink>;

export interface DesktopLinkRequest {
	sandboxId: string;
	client: Client;
}

export async function createDesktopLink(
	request: DesktopLinkRequest,
	options: DesktopLinkOptions = {}
): Promise<DesktopLink> {
	const { client, sandboxId } = request;
	const headers = {
		'Idempotency-Key': resolveIdempotencyKey(options.idempotencyKey),
	};
	const exposure = (
		await requestSystemExposure({
			client,
			path: {
				sandboxId,
				service: SystemExposureService.Desktop,
			},
			headers,
			body: { durationSeconds: DESKTOP_EXPOSURE_LEASE_SECONDS },
		})
	).data;
	return (
		await createProtectedAccessGrant({
			client,
			path: { sandboxId, exposureId: exposure.id },
			headers,
			body: { sessionLifetimeSeconds: options.sessionLifetimeSeconds },
		})
	).data;
}
