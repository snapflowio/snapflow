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
	awaitSandboxStateChange,
	type BuildInfo,
	getSandbox,
	type Location,
	type ResizeSandbox,
	replaceLabels,
	resizeSandbox,
	type SandboxCapability,
	type Sandbox as SandboxDto,
	type SandboxListItem as SandboxListItemDto,
	SandboxState,
	type SandboxVolume,
	setAutoArchiveInterval,
	setAutoDeleteInterval,
	setAutostopInterval,
	type UpdateSandboxNetworkSettings,
	updateLastActivity,
	updateNetworkSettings,
} from '@snapflow/api-client';
import type { Client } from '@snapflow/api-client/client';
import {
	SnapflowNotFoundError,
	SnapflowValidationError,
} from '../errors/snapflow-error.js';
import type { Resources } from '../snapflow.types.js';
import { requestSignal } from '../utils/http.js';
import {
	assertNonNegativeTimeout,
	DEFAULT_SANDBOX_TIMEOUT_SECONDS,
	remainingTimeoutSeconds,
} from '../utils/timeout.js';
import { assertNonNegativeInteger } from '../utils/validation.js';
import { waitForSandboxState } from './state-wait.js';
export abstract class SandboxBase {
	public id!: string;
	public name!: string;
	public organizationId!: string;
	public snapshot?: string;
	public user!: string;
	public env?: Record<string, string>;
	public labels!: Record<string, string>;
	public location!: Location | null;
	public cpu!: number;
	public gpu!: number;
	public memory!: number;
	public disk!: number;
	public state?: SandboxState;
	public errorReason?: string;
	public recoverable?: boolean;
	public backupState?: SandboxDto['backupState'];
	public backupCreatedAt?: string;
	public autoStopInterval?: number;
	public autoArchiveInterval?: number;
	public autoDeleteInterval?: number;
	public volumes?: SandboxVolume[];
	public buildInfo?: BuildInfo;
	public createdAt?: string;
	public updatedAt?: string;
	public lastActivityAt?: string;
	public networkBlockAll?: boolean;
	public networkAllowList?: string;
	public domainAllowList?: string;
	public linkedSandboxId?: string;
	public capabilities?: SandboxCapability[];

	protected constructor(
		sandboxDto: SandboxDto | SandboxListItemDto,
		protected readonly client: Client
	) {
		this.processSandboxDto(sandboxDto);
	}

	public async refreshData(signal?: AbortSignal): Promise<void> {
		const response = await getSandbox({
			client: this.client,
			path: { sandboxIdOrName: this.id },
			signal,
		});
		this.processSandboxDto(response.data);
	}

	protected async awaitStateChange(
		waitSeconds: number,
		signal?: AbortSignal
	): Promise<void> {
		const response = await awaitSandboxStateChange({
			client: this.client,
			path: { sandboxIdOrName: this.id },
			query: {
				observedState: this.state ?? SandboxState.Unknown,
				waitSeconds,
			},
			signal,
		});
		this.processSandboxDto(response.data);
	}

	protected async awaitStateChangeSafe(
		waitSeconds: number,
		signal?: AbortSignal
	): Promise<void> {
		try {
			await this.awaitStateChange(waitSeconds, signal);
		} catch (error) {
			if (!(error instanceof SnapflowNotFoundError)) throw error;
			this.state = SandboxState.Destroyed;
		}
	}

	public async refreshActivity(): Promise<void> {
		await updateLastActivity({
			client: this.client,
			path: { sandboxId: this.id },
		});
	}

	public async setLabels(
		labels: Record<string, string>
	): Promise<Record<string, string>> {
		this.labels = (
			await replaceLabels({
				client: this.client,
				path: { sandboxIdOrName: this.id },
				body: { labels },
			})
		).data.labels;
		return this.labels;
	}

	public async setAutostopInterval(interval: number): Promise<void> {
		assertNonNegativeInteger(interval, 'autoStopInterval');
		await setAutostopInterval({
			client: this.client,
			path: { sandboxIdOrName: this.id, interval },
		});
		this.autoStopInterval = interval;
	}

	public async setAutoArchiveInterval(interval: number): Promise<void> {
		assertNonNegativeInteger(interval, 'autoArchiveInterval');
		await setAutoArchiveInterval({
			client: this.client,
			path: { sandboxIdOrName: this.id, interval },
		});
		this.autoArchiveInterval = interval;
	}

	public async setAutoDeleteInterval(interval: number): Promise<void> {
		await setAutoDeleteInterval({
			client: this.client,
			path: { sandboxIdOrName: this.id, interval },
		});
		this.autoDeleteInterval = interval;
	}

	public async updateNetworkSettings(
		settings: UpdateSandboxNetworkSettings
	): Promise<void> {
		if (
			settings.networkBlockAll === undefined &&
			settings.networkAllowList === undefined &&
			settings.domainAllowList === undefined
		) {
			throw new SnapflowValidationError(
				'At least one of networkBlockAll, networkAllowList or domainAllowList must be set'
			);
		}
		const response = await updateNetworkSettings({
			client: this.client,
			path: { sandboxIdOrName: this.id },
			body: settings,
		});
		this.processSandboxDto(response.data);
	}

	public async resize(
		resources: Pick<Resources, 'cpu' | 'memory' | 'disk'>,
		timeout = DEFAULT_SANDBOX_TIMEOUT_SECONDS
	): Promise<void> {
		assertNonNegativeTimeout(timeout);
		if ('gpu' in resources || 'gpuType' in resources) {
			throw new SnapflowValidationError(
				'Resize does not support changes to gpu or gpuType — to change GPU, create a new Sandbox'
			);
		}

		const startTime = Date.now();
		const resizeRequest: ResizeSandbox = {
			cpu: resources.cpu,
			memory: resources.memory,
			disk: resources.disk,
		};
		const response = await resizeSandbox({
			client: this.client,
			path: { sandboxIdOrName: this.id },
			body: resizeRequest,
			signal: requestSignal(timeout),
		});
		this.processSandboxDto(response.data);
		await this.waitForResizeComplete(
			remainingTimeoutSeconds(timeout, startTime)
		);
	}

	public async waitForResizeComplete(
		timeout = DEFAULT_SANDBOX_TIMEOUT_SECONDS
	): Promise<void> {
		assertNonNegativeTimeout(timeout);
		await waitForSandboxState({
			isPending: () => this.state === SandboxState.Resizing,
			awaitChange: (waitSeconds, signal) =>
				this.awaitStateChange(waitSeconds, signal),
			failureMessage: () =>
				this.state === SandboxState.Error ||
				this.state === SandboxState.BuildFailed
					? `Sandbox ${this.id} resize failed with state: ${this.state}, error reason: ${this.errorReason}`
					: undefined,
			timeoutMessage:
				'Sandbox resize did not complete within the timeout period',
			timeoutSeconds: timeout,
		});
	}

	protected processSandboxDto(sandboxDto: SandboxDto | SandboxListItemDto) {
		this.id = sandboxDto.id;
		this.name = sandboxDto.name;
		this.organizationId = sandboxDto.organizationId;
		this.snapshot = sandboxDto.snapshot;
		this.user = sandboxDto.user;
		this.labels = sandboxDto.labels;
		this.location = sandboxDto.location;
		this.cpu = sandboxDto.cpu;
		this.gpu = sandboxDto.gpu;
		this.memory = sandboxDto.memory;
		this.disk = sandboxDto.disk;
		this.state = sandboxDto.state;
		this.errorReason = sandboxDto.errorReason;
		this.recoverable = sandboxDto.recoverable;
		this.backupState = sandboxDto.backupState;
		this.autoStopInterval = sandboxDto.autoStopInterval;
		this.autoArchiveInterval = sandboxDto.autoArchiveInterval;
		this.autoDeleteInterval = sandboxDto.autoDeleteInterval;
		this.createdAt = sandboxDto.createdAt;
		this.updatedAt = sandboxDto.updatedAt;
		this.lastActivityAt = sandboxDto.lastActivityAt;
		if ('env' in sandboxDto) {
			this.env = sandboxDto.env;
			this.networkBlockAll = sandboxDto.networkBlockAll;
			this.networkAllowList = sandboxDto.networkAllowList;
			this.domainAllowList = sandboxDto.domainAllowList;
			this.linkedSandboxId = sandboxDto.linkedSandboxId;
			this.capabilities = sandboxDto.capabilities;
			this.volumes = sandboxDto.volumes;
			this.buildInfo = sandboxDto.buildInfo;
			this.backupCreatedAt = sandboxDto.backupCreatedAt;
		}
	}
}
