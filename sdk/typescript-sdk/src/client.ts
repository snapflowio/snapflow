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

import {
	BucketsApi,
	Configuration,
	ImagesApi,
	type PaginatedSandboxes as PaginatedSandboxesDto,
	SandboxApi,
	type Sandbox as SandboxDto,
	SandboxState,
} from '@snapflow/api-client';
import axios, { type AxiosError, type AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';
import * as packageJson from '../package.json';
import {
	SnapflowError,
	SnapflowNotFoundError,
	SnapflowRateLimitError,
} from './errors';
import { BucketService } from './resources/buckets';
import { ImageService } from './resources/images';
import {
	type SandboxCodeToolbox,
	SandboxTsCodeToolbox,
} from './runtimes/typescript';
import {
	SandboxBuilder,
	type SandboxConfig,
	type SandboxCreateOptions,
} from './sandbox/builder';
import { Sandbox } from './sandbox/sandbox';
import { CodeLanguage } from './types';
import { processStreamingResponse } from './utils/stream';

export interface SnapflowConfig {
	apiKey?: string;
	jwtToken?: string;
	organizationId?: string;
	apiUrl?: string;
}

export interface SandboxFilter {
	id?: string;
	labels?: Record<string, string>;
}

export interface PaginatedSandboxes
	extends Omit<PaginatedSandboxesDto, 'items'> {
	items: Sandbox[];
}

const DEFAULT_TIMEOUT = 60;
const DEFAULT_API_URL = 'https://app.snapflow.io/api';
const AXIOS_TIMEOUT = 24 * 60 * 60 * 1000;

export class Snapflow {
	private readonly sandboxApi: SandboxApi;
	private readonly apiKey?: string;
	private readonly jwtToken?: string;
	private readonly organizationId?: string;
	private readonly apiUrl: string;
	private readonly codeToolboxCache = new Map<
		CodeLanguage,
		SandboxCodeToolbox
	>();
	private readonly baseHeaders: Record<string, string>;

	public readonly image: ImageService;
	public readonly bucket: BucketService;

	constructor(config?: SnapflowConfig) {
		const resolvedConfig = this.resolveConfig(config);
		this.validateConfig(resolvedConfig);

		this.apiKey = resolvedConfig.apiKey;
		this.jwtToken = resolvedConfig.jwtToken;
		this.organizationId = resolvedConfig.organizationId;
		this.apiUrl = resolvedConfig.apiUrl!;

		const axiosInstance = this.createAxiosInstance();
		const configuration = this.createConfiguration(axiosInstance);

		this.baseHeaders = configuration.baseOptions?.headers ?? {};

		this.sandboxApi = new SandboxApi(configuration, '', axiosInstance);
		this.image = new ImageService(
			new ImagesApi(configuration, '', axiosInstance)
		);
		this.bucket = new BucketService(
			new BucketsApi(configuration, '', axiosInstance)
		);
	}

	sandbox(): SandboxBuilder {
		return new SandboxBuilder((config, options) =>
			this.createSandbox(config, options)
		);
	}

	async get(sandboxId: string): Promise<Sandbox> {
		const response = await this.sandboxApi.getSandbox(sandboxId);
		const sandboxInstance = response.data;
		const language = sandboxInstance.labels?.[
			'code-toolbox-language'
		] as CodeLanguage;

		return new Sandbox(
			sandboxInstance,
			this.sandboxApi,
			this.createAxiosInstance(),
			this.baseHeaders,
			this.getCodeToolbox(language)
		);
	}

	async find(filter: SandboxFilter): Promise<Sandbox> {
		if (filter.id) {
			return this.get(filter.id);
		}

		const result = await this.list(filter.labels, 1, 1);
		if (result.items.length === 0) {
			throw new SnapflowError(
				`No sandbox found with labels ${JSON.stringify(filter.labels)}`
			);
		}

		return result.items[0];
	}

	async list(
		labels?: Record<string, string>,
		page?: number,
		limit?: number
	): Promise<PaginatedSandboxes> {
		const response = await this.sandboxApi.listSandboxesPaginated(
			undefined,
			page,
			limit,
			labels ? JSON.stringify(labels) : undefined
		);

		return {
			items: response.data.items.map((sandbox: SandboxDto) => {
				const language = sandbox.labels?.[
					'code-toolbox-language'
				] as CodeLanguage;
				return new Sandbox(
					sandbox,
					this.sandboxApi,
					this.createAxiosInstance(),
					this.baseHeaders,
					this.getCodeToolbox(language)
				);
			}),
			total: response.data.total,
			page: response.data.page,
			totalPages: response.data.totalPages,
		};
	}

	private async createSandbox(
		config: SandboxConfig,
		options: SandboxCreateOptions
	): Promise<Sandbox> {
		const startTime = Date.now();
		const timeout = options.timeout ?? DEFAULT_TIMEOUT;
		const language = (config.language ??
			CodeLanguage.TYPESCRIPT) as CodeLanguage;
		const codeToolbox = this.getCodeToolbox(language);

		const labels = { ...config.labels };
		if (config.language) {
			labels['code-toolbox-language'] =
				typeof config.language === 'string' ? config.language : config.language;
		}

		const createParams = {
			image: config.image,
			buildInfo: undefined,
			user: config.user,
			env: config.envVars ?? {},
			labels,
			public: config.public,
			cpu: config.resources?.cpu,
			gpu: config.resources?.gpu,
			memory: config.resources?.memory,
			disk: config.resources?.disk,
			autoStopInterval: config.autoStopInterval,
			buckets: config.buckets,
			networkBlockAll: config.network?.blockAll,
			networkAllowList: config.network?.allowList,
		};

		try {
			let sandboxData = (
				await this.sandboxApi.createSandbox(createParams, undefined, {
					timeout: timeout * 1000,
				})
			).data;

			if (
				sandboxData.state === SandboxState.PENDING_BUILD &&
				options.onBuildLogs
			) {
				sandboxData = await this.handleBuildLogs(
					sandboxData,
					options.onBuildLogs
				);
			}

			const sandbox = new Sandbox(
				sandboxData,
				this.sandboxApi,
				this.createAxiosInstance(),
				this.baseHeaders,
				codeToolbox
			);

			if (sandbox.state !== 'started') {
				const remainingTimeout = timeout - (Date.now() - startTime) / 1000;
				await sandbox.waitUntilStarted(Math.max(0, remainingTimeout));
			}

			return sandbox;
		} catch (error) {
			if (
				error instanceof SnapflowError &&
				error.message.includes('Operation timed out')
			) {
				throw new SnapflowError(
					`Failed to create and start sandbox within ${timeout} seconds. Operation timed out.`
				);
			}
			throw error;
		}
	}

	private async handleBuildLogs(
		sandboxInstance: any,
		onBuildLogs: (chunk: string) => void
	) {
		const terminalStates = [
			SandboxState.STARTED,
			SandboxState.STARTING,
			SandboxState.ERROR,
			SandboxState.BUILD_FAILED,
		];

		while (sandboxInstance.state === SandboxState.PENDING_BUILD) {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			sandboxInstance = (await this.sandboxApi.getSandbox(sandboxInstance.id))
				.data;
		}

		await processStreamingResponse(
			() =>
				this.sandboxApi.getBuildLogs(sandboxInstance.id, undefined, true, {
					responseType: 'stream',
				}),
			(chunk) => onBuildLogs(chunk.trimEnd()),
			async () => {
				sandboxInstance = (await this.sandboxApi.getSandbox(sandboxInstance.id))
					.data;
				return (
					sandboxInstance.state !== undefined &&
					terminalStates.includes(sandboxInstance.state)
				);
			}
		);

		return sandboxInstance;
	}

	private resolveConfig(config?: SnapflowConfig): SnapflowConfig {
		const envConfig = this.loadEnvironmentConfig();

		return {
			apiKey:
				config?.apiKey ?? (config?.jwtToken ? undefined : envConfig.apiKey),
			jwtToken: config?.jwtToken ?? envConfig.jwtToken,
			organizationId: config?.organizationId ?? envConfig.organizationId,
			apiUrl: config?.apiUrl ?? envConfig.apiUrl ?? DEFAULT_API_URL,
		};
	}

	private loadEnvironmentConfig(): Partial<SnapflowConfig> {
		dotenv.config({ path: '.env.local', override: true });

		return {
			apiKey: process?.env['snapflow_API_KEY'],
			jwtToken: process?.env['snapflow_JWT_TOKEN'],
			organizationId: process?.env['snapflow_ORGANIZATION_ID'],
			apiUrl: process?.env['snapflow_API_URL'],
		};
	}

	private validateConfig(config: SnapflowConfig): void {
		const hasApiKeyAuth = config.apiKey && config.apiUrl;
		const hasJwtAuth =
			config.jwtToken && config.organizationId && config.apiUrl;

		if (!hasApiKeyAuth && !hasJwtAuth) {
			throw new SnapflowError(
				'Invalid configuration: missing required authentication parameters'
			);
		}

		if (config.jwtToken && !config.organizationId) {
			throw new SnapflowError(
				'Organization ID is required when using JWT token'
			);
		}
	}

	private createAxiosInstance(): AxiosInstance {
		const instance = axios.create({ timeout: AXIOS_TIMEOUT });

		instance.interceptors.response.use(
			(response) => response,
			(error) => this.handleAxiosError(error)
		);

		return instance;
	}

	private handleAxiosError(error: AxiosError): never {
		const isTimeout = error.message.includes('timeout of');
		const statusCode = error.response?.status;
		const errorData = error.response?.data as any;

		const errorMessage = isTimeout
			? 'Operation timed out'
			: errorData?.message || errorData || error.message || String(error);

		const message = this.formatErrorMessage(errorMessage);

		if (statusCode === 404) {
			throw new SnapflowNotFoundError(message);
		}

		if (statusCode === 429) {
			throw new SnapflowRateLimitError(message);
		}

		throw new SnapflowError(message);
	}

	private formatErrorMessage(message: unknown): string {
		try {
			return typeof message === 'string' ? message : JSON.stringify(message);
		} catch {
			return String(message);
		}
	}

	private createConfiguration(axiosInstance: AxiosInstance): Configuration {
		const headers: Record<string, string> = {
			'X-Snapflow-Source': 'typescript-sdk',
			'X-Snapflow-SDK-Version': packageJson.version,
		};

		if (this.apiKey) {
			headers['Authorization'] = `Bearer ${this.apiKey}`;
		} else if (this.jwtToken) {
			headers['Authorization'] = `Bearer ${this.jwtToken}`;
			if (this.organizationId) {
				headers['X-Snapflow-Organization-ID'] = this.organizationId;
			}
		}

		return new Configuration({
			basePath: this.apiUrl,
			baseOptions: { headers },
		});
	}

	private getCodeToolbox(language?: CodeLanguage): SandboxCodeToolbox {
		if (!language) {
			language = CodeLanguage.TYPESCRIPT;
		}

		if (!this.codeToolboxCache.has(language)) {
			const toolbox = this.createCodeToolbox(language);
			this.codeToolboxCache.set(language, toolbox);
		}

		return this.codeToolboxCache.get(language)!;
	}

	private createCodeToolbox(language: CodeLanguage): SandboxCodeToolbox {
		switch (language) {
			case CodeLanguage.TYPESCRIPT:
				return new SandboxTsCodeToolbox();
			default:
				throw new SnapflowError(`Unsupported code language: ${language}`);
		}
	}
}
