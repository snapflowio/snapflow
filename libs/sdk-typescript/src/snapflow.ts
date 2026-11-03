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

import type {
	Sandbox as SandboxDto,
	SandboxListItem as SandboxListItemDto,
	SandboxQuote,
} from '@snapflow/api-client';
import {
	createSandbox,
	getSandbox,
	quoteSandbox,
	SandboxState,
} from '@snapflow/api-client';
import type { Client } from '@snapflow/api-client/client';
import { Sandbox } from './sandbox.js';
import type {
	ListSandboxesQuery,
	StartSandboxOptions,
} from './sandbox.types.js';
import {
	createApiClient,
	resolveClientConfig,
	SDK_VERSION,
} from './snapflow/client-config.js';
import {
	type CreateSandboxParams,
	prepareCreateSandboxLabels,
	resolveBuildInfo,
	toCreateSandboxRequest,
	toSandboxQuoteRequest,
} from './snapflow/create-sandbox-request.js';
import {
	forwardSandboxBuildLog,
	isImageBuildState,
	waitForImageBuild,
} from './snapflow/image-build.js';
import { listSandboxItems } from './snapflow/sandbox-pages.js';
import type {
	CreateSandboxFromImageParams,
	CreateSandboxFromSnapshotParams,
	CreateSandboxOptions,
	QuoteSandboxParams,
	SnapflowConfig,
} from './snapflow.types.js';
import { SnapshotService } from './snapshot.js';
import { requestSignal } from './utils/http.js';
import {
	type IdempotentOperationOptions,
	resolveIdempotencyKey,
} from './utils/idempotency.js';
import {
	DEFAULT_SANDBOX_TIMEOUT_SECONDS,
	remainingTimeoutSeconds,
} from './utils/timeout.js';
import { VolumeService } from './volume.js';

export class Snapflow {
	private readonly client: Client;
	public readonly volume: VolumeService;
	public readonly snapshot: SnapshotService;

	constructor(config?: SnapflowConfig) {
		this.client = createApiClient(resolveClientConfig(config), SDK_VERSION);
		this.volume = new VolumeService(this.client);
		this.snapshot = new SnapshotService(this.client);
	}

	public async quote(params: QuoteSandboxParams = {}): Promise<SandboxQuote> {
		const response = await quoteSandbox({
			client: this.client,
			body: toSandboxQuoteRequest(params),
		});
		return response.data;
	}

	public async create(
		params: CreateSandboxFromSnapshotParams,
		options?: IdempotentOperationOptions & {
			timeout?: number;
			signal?: AbortSignal;
		}
	): Promise<Sandbox>;
	public async create(
		params: CreateSandboxFromImageParams,
		options?: {
			idempotencyKey?: string;
			onSnapshotCreateLogs?: (chunk: string) => void;
			timeout?: number;
			signal?: AbortSignal;
		}
	): Promise<Sandbox>;
	public async create(
		params: CreateSandboxParams,
		options: CreateSandboxOptions = {}
	): Promise<Sandbox> {
		options.signal?.throwIfAborted();
		const startTime = Date.now();
		const timeout = options.timeout ?? DEFAULT_SANDBOX_TIMEOUT_SECONDS;
		const labels = prepareCreateSandboxLabels(params, timeout);
		const idempotencyKey = resolveIdempotencyKey(options.idempotencyKey);
		const buildInfo = await resolveBuildInfo(this.client, params);

		const response = await createSandbox({
			client: this.client,
			headers: { 'Idempotency-Key': idempotencyKey },
			body: toCreateSandboxRequest(params, labels, buildInfo),
			signal: requestSignal(timeout, options.signal),
		});

		let sandboxInstance = response.data;

		if (
			options.onSnapshotCreateLogs &&
			isImageBuildState(sandboxInstance.state)
		) {
			sandboxInstance = await waitForImageBuild(
				this.client,
				sandboxInstance,
				timeout,
				startTime,
				options.signal
			);
			await forwardSandboxBuildLog(
				sandboxInstance,
				this.client,
				SDK_VERSION,
				options.onSnapshotCreateLogs,
				options.signal
			);
		}

		const sandbox = this.toSandbox(sandboxInstance);

		if (sandbox.state !== SandboxState.Started) {
			await sandbox.waitUntilStarted(
				remainingTimeoutSeconds(timeout, startTime),
				options.signal
			);
		}

		return sandbox;
	}

	public async get(sandboxIdOrName: string): Promise<Sandbox> {
		const response = await getSandbox({
			client: this.client,
			path: { sandboxIdOrName },
		});
		return this.toSandbox(response.data);
	}

	public list(query?: ListSandboxesQuery): AsyncIterableIterator<Sandbox> {
		const items = listSandboxItems(this.client, query);
		const toSandbox = (item: SandboxListItemDto) => this.toSandbox(item);
		async function* generator(): AsyncGenerator<Sandbox> {
			for await (const item of items) {
				yield toSandbox(item);
			}
		}

		return generator();
	}

	public async start(sandbox: Sandbox, options?: StartSandboxOptions) {
		await sandbox.start(options);
	}

	public async stop(sandbox: Sandbox) {
		await sandbox.stop();
	}

	public async _experimental_fork(
		sandbox: Sandbox,
		params?: { name?: string } & IdempotentOperationOptions,
		timeout = DEFAULT_SANDBOX_TIMEOUT_SECONDS
	): Promise<Sandbox> {
		return await sandbox._experimental_fork(params, timeout);
	}

	public async delete(
		sandbox: Sandbox,
		timeout = DEFAULT_SANDBOX_TIMEOUT_SECONDS
	) {
		await sandbox.delete(timeout);
	}

	private toSandbox(sandboxDto: SandboxDto | SandboxListItemDto): Sandbox {
		return new Sandbox(sandboxDto, this.client);
	}
}
