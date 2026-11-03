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
	type CodeRunRequest,
	codeRun,
	executeCommand,
} from '@snapflow/toolbox-api-client';
import type { ToolboxAccess } from './edge-toolbox-session.js';
import { ProcessSessions } from './process/process-sessions.js';
import type { CodeRunParams } from './process.types.js';
import { parseChart } from './types/charts.js';
import type { ExecuteResponse } from './types/execute-response.js';

export class Process extends ProcessSessions {
	constructor(
		toolbox: ToolboxAccess,
		private readonly language?: string
	) {
		super(toolbox);
	}

	public async executeCommand(
		command: string,
		cwd?: string,
		env?: Record<string, string>,
		timeout?: number
	): Promise<ExecuteResponse> {
		const response = await executeCommand({
			client: await this.toolbox.client(),
			body: {
				command,
				timeout,
				cwd,
				envs: env && Object.keys(env).length ? env : undefined,
			},
		});

		const { exitCode, result } = response.data;
		return {
			exitCode,
			result,
			artifacts: {
				stdout: result,
			},
		};
	}

	public async codeRun(
		code: string,
		params?: CodeRunParams,
		timeout?: number
	): Promise<ExecuteResponse> {
		if (!this.language) {
			throw new Error('Code language is required for codeRun');
		}

		const request: CodeRunRequest = {
			code,
			language: this.language,
			argv: params?.argv,
			envs: params?.env,
			timeout,
		};
		const response = await codeRun({
			client: await this.toolbox.client(),
			body: request,
		});
		const data = response.data;

		const charts = data.artifacts?.charts?.map(parseChart) ?? [];

		return {
			exitCode: data.exitCode,
			result: data.result,
			artifacts: {
				stdout: data.result,
				charts,
			},
		};
	}
}
