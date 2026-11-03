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
	createSshAccess,
	ensurePreviewExposure,
	forkSandbox,
	type ProtectedAccessGrantDto,
	revokeProtectedAccessGrant,
	revokeSshAccess,
	type Sandbox as SandboxDto,
	type SandboxListItem as SandboxListItemDto,
	type SshAccessDto,
} from '@snapflow/api-client';
import type { Client } from '@snapflow/api-client/client';
import { getUserHomeDir, getWorkDir } from '@snapflow/toolbox-api-client';
import type { CodeInterpreter } from './code-interpreter.js';
import type { ComputerUse } from './computer-use.js';
import type { EdgeToolboxSession } from './edge-toolbox-session.js';
import type { FileSystem } from './file-system.js';
import type { Git } from './git.js';
import { type LspLanguageId, LspServer } from './lsp-server.js';
import type { Process } from './process.js';
import { SandboxLifecycle } from './sandbox/sandbox-lifecycle.js';
import { createSandboxServices } from './sandbox/sandbox-services.js';
import { CODE_TOOLBOX_LANGUAGE_LABEL } from './snapflow.types.js';
import { requestSignal } from './utils/http.js';
import {
	type IdempotentOperationOptions,
	resolveIdempotencyKey,
} from './utils/idempotency.js';
import {
	assertNonNegativeTimeout,
	DEFAULT_SANDBOX_TIMEOUT_SECONDS,
	remainingTimeoutSeconds,
} from './utils/timeout.js';

export class Sandbox extends SandboxLifecycle {
	public readonly fs: FileSystem;
	public readonly git: Git;
	public readonly process: Process;
	public readonly computerUse: ComputerUse;
	public readonly codeInterpreter: CodeInterpreter;

	private readonly toolbox: EdgeToolboxSession;

	constructor(sandboxDto: SandboxDto | SandboxListItemDto, client: Client) {
		super(sandboxDto, client);
		const services = createSandboxServices({
			sandboxId: this.id,
			language: sandboxDto.labels?.[CODE_TOOLBOX_LANGUAGE_LABEL],
			client,
		});
		this.fs = services.fs;
		this.git = services.git;
		this.process = services.process;
		this.codeInterpreter = services.codeInterpreter;
		this.computerUse = services.computerUse;
		this.toolbox = services.toolbox;
	}

	public async getUserHomeDir(): Promise<string | undefined> {
		const response = await getUserHomeDir({
			client: await this.toolbox.client(),
		});
		return response.data.dir;
	}

	public async getWorkDir(): Promise<string | undefined> {
		const response = await getWorkDir({ client: await this.toolbox.client() });
		return response.data.dir;
	}

	public async createLspServer(
		languageId: LspLanguageId | string,
		pathToProject: string
	): Promise<LspServer> {
		return new LspServer(
			languageId as LspLanguageId,
			pathToProject,
			this.toolbox.client
		);
	}

	public async _experimental_fork(
		params?: { name?: string } & IdempotentOperationOptions,
		timeout = DEFAULT_SANDBOX_TIMEOUT_SECONDS
	): Promise<Sandbox> {
		assertNonNegativeTimeout(timeout);
		const startTime = Date.now();
		const response = await forkSandbox({
			client: this.client,
			path: { sandboxIdOrName: this.id },
			headers: {
				'Idempotency-Key': resolveIdempotencyKey(params?.idempotencyKey),
			},
			body: { name: params?.name },
			signal: requestSignal(timeout),
		});

		const forkedSandbox = new Sandbox(response.data, this.client);
		await forkedSandbox.waitUntilStarted(
			remainingTimeoutSeconds(timeout, startTime)
		);

		return forkedSandbox;
	}

	public async getPreviewLink(port: number): Promise<ProtectedAccessGrantDto> {
		return this.createPreviewAccess(port);
	}

	public async getSignedPreviewUrl(
		port: number,
		expiresInSeconds?: number
	): Promise<ProtectedAccessGrantDto> {
		return this.createPreviewAccess(port, expiresInSeconds);
	}

	public async expireSignedPreviewUrl(
		port: number,
		token: string
	): Promise<void> {
		const exposureId = await this.ensurePreviewExposureId(port);
		await revokeProtectedAccessGrant({
			client: this.client,
			path: {
				sandboxId: this.id,
				exposureId,
				token,
			},
		});
	}

	private async ensurePreviewExposureId(port: number): Promise<string> {
		const exposure = (
			await ensurePreviewExposure({
				client: this.client,
				path: { sandboxId: this.id, port },
			})
		).data;
		return exposure.id;
	}

	private async createPreviewAccess(
		port: number,
		sessionLifetimeSeconds?: number
	): Promise<ProtectedAccessGrantDto> {
		const exposureId = await this.ensurePreviewExposureId(port);
		return (
			await createProtectedAccessGrant({
				client: this.client,
				path: {
					sandboxId: this.id,
					exposureId,
				},
				headers: { 'Idempotency-Key': resolveIdempotencyKey() },
				body: { sessionLifetimeSeconds },
			})
		).data;
	}

	public async createSshAccess(
		expiresInMinutes?: number,
		options: IdempotentOperationOptions = {}
	): Promise<SshAccessDto> {
		return (
			await createSshAccess({
				client: this.client,
				path: { sandboxIdOrName: this.id },
				headers: {
					'Idempotency-Key': resolveIdempotencyKey(options.idempotencyKey),
				},
				query: { expiresInMinutes },
			})
		).data;
	}

	public async revokeSshAccess(token: string): Promise<void> {
		await revokeSshAccess({
			client: this.client,
			path: { sandboxIdOrName: this.id },
			query: { token },
		});
	}
}
