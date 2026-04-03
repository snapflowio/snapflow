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

/*
 * Copyright 2025 Snapflow
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
	BackupState,
	BuildInfo,
	PortPreviewUrl,
	SandboxApi,
	SandboxBucketRef,
	SandboxClass,
	SandboxDesiredState,
	Sandbox as SandboxDto,
	SandboxState,
} from '@snapflow/api-client';
import {
	ComputerUseApi,
	FileSystemApi,
	GitApi,
	InfoApi,
	LspApi,
	ProcessApi,
	Configuration as ToolboxConfiguration,
} from '@snapflow/toolbox-client';
import type { AxiosInstance } from 'axios';
import { SnapflowError } from '../errors';
import type { SandboxCodeToolbox } from '../runtimes/typescript';
import { ComputerUse } from '../services/computer';
import { FileSystem } from '../services/filesystem';
import { Git } from '../services/git';
import { type LspLanguageId, LspServer } from '../services/lsp';
import { Network } from '../services/network';
import { Process, type ProcessExecuteOptions } from '../services/process';
import type { ExecuteResponse } from '../types';
import { prefixRelativePath } from '../utils/path';
import {
	createWorkspaceInSandbox,
	type Workspace,
	type WorkspaceCreateOptions,
	type WorkspaceLanguage,
} from './workspace';

const DEFAULT_TIMEOUT = 60;
const POLL_INTERVAL = 100;

export class Sandbox implements SandboxDto {
	public readonly fs: FileSystem;
	public readonly git: Git;
	public readonly process: Process;
	public readonly computerUse: ComputerUse;
	public readonly network: Network;

	public id!: string;
	public organizationId!: string;
	public image?: string;
	public user!: string;
	public env!: Record<string, string>;
	public labels!: Record<string, string>;
	public public!: boolean;
	public target!: string;
	public cpu!: number;
	public gpu!: number;
	public memory!: number;
	public disk!: number;
	public class!: SandboxClass;
	public desiredState!: SandboxDesiredState;
	public state!: SandboxState;
	public errorReason?: string;
	public autoStopInterval?: number;
	public autoDeleteInterval?: number;
	public executorDomain?: string;
	public nodeVersion?: string;
	public buckets!: Array<SandboxBucketRef>;
	public buildInfo?: BuildInfo;
	public backupState!: BackupState;
	public backupCreatedAt?: Date;
	public networkBlockAll!: boolean;
	public networkAllowList?: string;
	public createdAt!: Date;
	public updatedAt!: Date;

	private rootDir = '';
	private rootDirPromise?: Promise<string>;
	private readonly toolboxConfig: ToolboxConfiguration;
	private readonly infoApi: InfoApi;

	constructor(
		sandboxDto: SandboxDto,
		private readonly sandboxApi: SandboxApi,
		axiosInstance: AxiosInstance,
		baseHeaders: Record<string, string>,
		private readonly codeToolbox: SandboxCodeToolbox
	) {
		this.updateFromDto(sandboxDto);

		this.toolboxConfig = new ToolboxConfiguration({
			basePath: sandboxDto.toolboxProxyUrl ?? '',
			baseOptions: { headers: { ...baseHeaders } },
		});

		this.infoApi = new InfoApi(this.toolboxConfig, '', axiosInstance);
		const services = this.initializeServices(axiosInstance);
		this.fs = services.fs;
		this.git = services.git;
		this.process = services.process;
		this.computerUse = services.computerUse;
		this.network = services.network;
	}

	async exec(
		command: string,
		options?: ProcessExecuteOptions
	): Promise<ExecuteResponse> {
		return this.process.executeCommand(command, options);
	}

	async upload(source: string | Buffer, remotePath: string): Promise<void> {
		return this.fs.uploadFile(source as any, remotePath);
	}

	async download(remotePath: string): Promise<Buffer> {
		return this.fs.downloadFile(remotePath);
	}

	async getUserRootDir(): Promise<string | undefined> {
		const response = await this.infoApi.getProjectDir();
		return (response.data as any)?.dir;
	}

	async createLspServer(
		languageId: LspLanguageId | string,
		pathToProject: string
	): Promise<LspServer> {
		const rootDir = await this.getRootDir();
		const fullPath = prefixRelativePath(rootDir, pathToProject);

		return new LspServer(
			languageId as LspLanguageId,
			fullPath,
			new LspApi(this.toolboxConfig, '', undefined as any)
		);
	}

	async setLabels(
		labels: Record<string, string>
	): Promise<Record<string, string>> {
		const response = await this.sandboxApi.replaceLabels(this.id, { labels });
		this.labels = response.data.labels;
		return this.labels;
	}

	async start(timeout = DEFAULT_TIMEOUT): Promise<void> {
		this.validateTimeout(timeout);

		const startTime = Date.now();
		const response = await this.sandboxApi.startSandbox(this.id, undefined, {
			timeout: timeout * 1000,
		});

		this.updateFromDto(response.data);

		const elapsedSeconds = (Date.now() - startTime) / 1000;
		const remainingTimeout = Math.max(0, timeout - elapsedSeconds);

		await this.waitUntilStarted(remainingTimeout);
	}

	async stop(timeout = DEFAULT_TIMEOUT): Promise<void> {
		this.validateTimeout(timeout);

		const startTime = Date.now();
		await this.sandboxApi.stopSandbox(this.id, undefined, {
			timeout: timeout * 1000,
		});

		await this.refreshData();

		const elapsedSeconds = (Date.now() - startTime) / 1000;
		const remainingTimeout = Math.max(0, timeout - elapsedSeconds);

		await this.waitUntilStopped(remainingTimeout);
	}

	async delete(timeout = DEFAULT_TIMEOUT): Promise<void> {
		await this.sandboxApi.deleteSandbox(this.id, undefined, {
			timeout: timeout * 1000,
		});
		await this.refreshData();
	}

	async archive(): Promise<void> {
		await this.sandboxApi.archiveSandbox(this.id);
		await this.refreshData();
	}

	async createBackup(): Promise<void> {
		await this.sandboxApi.createBackup(this.id);
		await this.refreshData();
	}

	async waitUntilStarted(timeout = DEFAULT_TIMEOUT): Promise<void> {
		await this.waitForState(
			(state) => state === 'started',
			(state) => state === 'error',
			timeout,
			'start'
		);
	}

	async waitUntilStopped(timeout = DEFAULT_TIMEOUT): Promise<void> {
		await this.waitForState(
			(state) => state === 'stopped' || state === 'destroyed',
			(state) => state === 'error',
			timeout,
			'stop'
		);
	}

	async refreshData(): Promise<void> {
		const response = await this.sandboxApi.getSandbox(this.id);
		this.updateFromDto(response.data);
	}

	async setAutostopInterval(interval: number): Promise<void> {
		this.validateInterval(interval, 'autoStopInterval');
		await this.sandboxApi.setAutostopInterval(this.id, interval);
		this.autoStopInterval = interval;
	}

	async setAutoDeleteInterval(interval: number): Promise<void> {
		if (!Number.isInteger(interval)) {
			throw new SnapflowError('autoDeleteInterval must be an integer');
		}
		await this.sandboxApi.setAutoDeleteInterval(this.id, interval);
		this.autoDeleteInterval = interval;
	}

	async getPreviewLink(port: number): Promise<PortPreviewUrl> {
		const response = await this.sandboxApi.getPortPreviewUrl(this.id, port);
		return response.data;
	}

	async createWorkspace(
		language: WorkspaceLanguage,
		options?: WorkspaceCreateOptions
	): Promise<Workspace> {
		return createWorkspaceInSandbox(
			language,
			this.fs,
			this.process,
			() => this.getRootDir(),
			(port) => this.getPreviewLink(port),
			options
		);
	}

	private initializeServices(axiosInstance: AxiosInstance) {
		const getRootDir = () => this.getRootDir();

		return {
			fs: new FileSystem(
				new FileSystemApi(this.toolboxConfig, '', axiosInstance),
				getRootDir
			),
			git: new Git(
				new GitApi(this.toolboxConfig, '', axiosInstance),
				getRootDir
			),
			process: new Process(
				this.codeToolbox,
				new ProcessApi(this.toolboxConfig, '', axiosInstance),
				getRootDir
			),
			computerUse: new ComputerUse(
				new ComputerUseApi(this.toolboxConfig, '', axiosInstance)
			),
			network: new Network(this.toolboxConfig, axiosInstance),
		};
	}

	private async getRootDir(): Promise<string> {
		if (this.rootDir) {
			return this.rootDir;
		}

		if (!this.rootDirPromise) {
			this.rootDirPromise = this.fetchRootDir();
		}

		return this.rootDirPromise;
	}

	private async fetchRootDir(): Promise<string> {
		const dir = await this.getUserRootDir();
		this.rootDir = dir || '';
		return this.rootDir;
	}

	private async waitForState(
		targetStatePredicate: (state?: SandboxState) => boolean,
		errorStatePredicate: (state?: SandboxState) => boolean,
		timeout: number,
		operation: string
	): Promise<void> {
		this.validateTimeout(timeout);

		const startTime = Date.now();
		const timeoutMs = timeout * 1000;

		while (!targetStatePredicate(this.state)) {
			await this.refreshData();

			if (targetStatePredicate(this.state)) {
				return;
			}

			if (errorStatePredicate(this.state)) {
				throw new SnapflowError(
					`Sandbox ${this.id} failed to ${operation} with status: ${this.state}, error reason: ${this.errorReason}`
				);
			}

			if (timeout !== 0 && Date.now() - startTime > timeoutMs) {
				throw new SnapflowError(
					`Sandbox failed to ${operation} within the timeout period`
				);
			}

			await this.delay(POLL_INTERVAL);
		}
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private validateTimeout(timeout: number): void {
		if (timeout < 0) {
			throw new SnapflowError('Timeout must be a non-negative number');
		}
	}

	private validateInterval(interval: number, name: string): void {
		if (!Number.isInteger(interval) || interval < 0) {
			throw new SnapflowError(`${name} must be a non-negative integer`);
		}
	}

	private updateFromDto(dto: SandboxDto): void {
		this.id = dto.id;
		this.organizationId = dto.organizationId;
		this.image = dto.image;
		this.user = dto.user;
		this.env = dto.env;
		this.labels = dto.labels;
		this.public = dto.public;
		this.target = dto.target;
		this.cpu = dto.cpu;
		this.gpu = dto.gpu;
		this.memory = dto.memory;
		this.disk = dto.disk;
		this.class = dto.class;
		this.desiredState = dto.desiredState;
		this.state = dto.state;
		this.errorReason = dto.errorReason;
		this.autoStopInterval = dto.autoStopInterval;
		this.autoDeleteInterval = dto.autoDeleteInterval;
		this.executorDomain = dto.executorDomain;
		this.nodeVersion = dto.nodeVersion;
		this.buckets = dto.buckets;
		this.buildInfo = dto.buildInfo;
		this.backupState = dto.backupState;
		this.backupCreatedAt = dto.backupCreatedAt;
		this.networkBlockAll = dto.networkBlockAll;
		this.networkAllowList = dto.networkAllowList;
		this.createdAt = dto.createdAt;
		this.updatedAt = dto.updatedAt;
	}
}
