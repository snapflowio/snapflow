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

import type { SandboxBucketRef } from '@snapflow/api-client';
import type { ExecuteResponse as ToolboxExecuteResponse } from '@snapflow/toolbox-client';

export type BucketMount = SandboxBucketRef;

export enum CodeLanguage {
	TYPESCRIPT = 'typescript',
	JAVASCRIPT = 'javascript',
	BUN = 'bun',
	GO = 'go',
	PHP = 'php',
	RUBY = 'ruby',
	LUA = 'lua',
	PYTHON = 'python',
	C = 'c',
}

export interface Resources {
	cpu?: number | null;
	gpu?: number | null;
	memory?: number | null;
	disk?: number | null;
}

export interface NetworkConfig {
	blockAll?: boolean;
	allowList?: string;
}

export interface ExecutionArtifacts {
	readonly stdout: string;
}

export interface ExecuteResponse extends ToolboxExecuteResponse {
	readonly result: string;
	readonly stderr?: string;
	readonly artifacts?: ExecutionArtifacts;
}

export type AsyncFunction<T = void> = () => Promise<T>;
export type StreamHandler = (chunk: string) => void;
