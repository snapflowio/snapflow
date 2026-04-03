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

import { SnapflowError } from '../errors';
import type {
	BucketMount,
	CodeLanguage,
	NetworkConfig,
	Resources,
} from '../types';
import type { Sandbox } from './sandbox';

export interface SandboxConfig {
	image?: string;
	user?: string;
	language?: CodeLanguage | string;
	envVars?: Record<string, string>;
	labels?: Record<string, string>;
	public?: boolean;
	autoStopInterval?: number;
	autoDeleteInterval?: number;
	buckets?: BucketMount[];
	network?: NetworkConfig;
	resources?: Resources;
}

export interface SandboxCreateOptions {
	onBuildLogs?: (chunk: string) => void;
	timeout?: number;
}

export type SandboxCreator = (
	config: SandboxConfig,
	options: SandboxCreateOptions
) => Promise<Sandbox>;

const DEFAULT_TIMEOUT = 60;

export class SandboxBuilder {
	private readonly config: SandboxConfig = {
		envVars: {},
		labels: {},
	};

	private readonly options: SandboxCreateOptions = {};

	constructor(private readonly creator: SandboxCreator) {}

	image(name: string): this {
		this.config.image = name;
		return this;
	}

	user(name: string): this {
		this.config.user = name;
		return this;
	}

	language(lang: CodeLanguage | string): this {
		this.config.language = lang;
		return this;
	}

	env(key: string, value: string): this {
		this.config.envVars![key] = value;
		return this;
	}

	envs(vars: Record<string, string>): this {
		Object.assign(this.config.envVars!, vars);
		return this;
	}

	label(key: string, value: string): this {
		this.config.labels![key] = value;
		return this;
	}

	labels(l: Record<string, string>): this {
		Object.assign(this.config.labels!, l);
		return this;
	}

	resources(r: Resources): this {
		this.config.resources = { ...this.config.resources, ...r };
		return this;
	}

	cpu(cores: number): this {
		this.config.resources = { ...this.config.resources, cpu: cores };
		return this;
	}

	gpu(count: number): this {
		this.config.resources = { ...this.config.resources, gpu: count };
		return this;
	}

	memory(mb: number): this {
		this.config.resources = { ...this.config.resources, memory: mb };
		return this;
	}

	disk(mb: number): this {
		this.config.resources = { ...this.config.resources, disk: mb };
		return this;
	}

	network(config: NetworkConfig): this {
		this.config.network = { ...this.config.network, ...config };
		return this;
	}

	allowList(hosts: string): this {
		this.config.network = { ...this.config.network, allowList: hosts };
		return this;
	}

	blockAll(): this {
		this.config.network = { ...this.config.network, blockAll: true };
		return this;
	}

	bucket(mount: BucketMount): this {
		if (!this.config.buckets) this.config.buckets = [];
		this.config.buckets.push(mount);
		return this;
	}

	buckets(mounts: BucketMount[]): this {
		this.config.buckets = [...(this.config.buckets ?? []), ...mounts];
		return this;
	}

	autoStop(seconds: number): this {
		this.config.autoStopInterval = seconds;
		return this;
	}

	autoDelete(seconds: number): this {
		this.config.autoDeleteInterval = seconds;
		return this;
	}

	setPublic(isPublic = true): this {
		this.config.public = isPublic;
		return this;
	}

	timeout(seconds: number): this {
		this.options.timeout = seconds;
		return this;
	}

	onBuildLogs(handler: (chunk: string) => void): this {
		this.options.onBuildLogs = handler;
		return this;
	}

	async create(): Promise<Sandbox> {
		this.validate();
		return this.creator(this.config, this.options);
	}

	private validate(): void {
		const { autoStopInterval, autoDeleteInterval } = this.config;
		const timeout = this.options.timeout ?? DEFAULT_TIMEOUT;

		if (timeout < 0) {
			throw new SnapflowError('Timeout must be a non-negative number');
		}

		if (
			autoStopInterval !== undefined &&
			(!Number.isInteger(autoStopInterval) || autoStopInterval < 0)
		) {
			throw new SnapflowError(
				'autoStopInterval must be a non-negative integer'
			);
		}

		if (
			autoDeleteInterval !== undefined &&
			(!Number.isInteger(autoDeleteInterval) || autoDeleteInterval < 0)
		) {
			throw new SnapflowError(
				'autoDeleteInterval must be a non-negative integer'
			);
		}
	}
}
