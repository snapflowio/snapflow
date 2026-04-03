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
	SessionExecuteResponse as ApiSessionExecuteResponse,
	CommandDto,
	ProcessApi,
	SessionDto,
	SessionExecuteRequest,
} from '@snapflow/toolbox-client';
import { SnapflowError } from '../errors';
import type { SandboxCodeToolbox } from '../runtimes/typescript';
import type { ExecuteResponse, StreamHandler } from '../types';
import { ArtifactParser } from '../utils/parser';
import { processStreamingResponse } from '../utils/stream';

export const STDOUT_PREFIX_BYTES = new Uint8Array([0x01, 0x01, 0x01]);
export const STDERR_PREFIX_BYTES = new Uint8Array([0x02, 0x02, 0x02]);

export interface SessionExecuteResponse extends ApiSessionExecuteResponse {
	stdout?: string;
	stderr?: string;
}

export interface SessionCommandLogsResponse {
	output?: string;
	stdout?: string;
	stderr?: string;
}

export interface CodeRunParams {
	readonly argv?: string[];
	readonly env?: Record<string, string>;
}

export interface ProcessExecuteOptions {
	readonly cwd?: string;
	readonly env?: Record<string, string>;
	readonly timeout?: number;
}

export class Process {
	constructor(
		private readonly codeToolbox: SandboxCodeToolbox,
		private readonly apiClient: ProcessApi,
		private readonly getRootDir: () => Promise<string>
	) {}

	public async executeCommand(
		command: string,
		options: ProcessExecuteOptions = {}
	): Promise<ExecuteResponse> {
		const { cwd, env, timeout } = options;
		const processedCommand = this.prepareCommand(command, env);

		try {
			const response = await this.apiClient.executeCommand({
				command: processedCommand,
				timeout,
				cwd: cwd ?? (await this.getRootDir()),
			});

			const artifacts = ArtifactParser.parseArtifacts(response.data.result);

			return {
				...response.data,
				exitCode: response.data.code,
				result: artifacts.stdout,
				artifacts,
			};
		} catch (error) {
			throw new SnapflowError(
				`Failed to execute command: ${command}`,
				error instanceof Error ? error : new Error(String(error))
			);
		}
	}

	public async codeRun(
		code: string,
		params?: CodeRunParams,
		timeout?: number
	): Promise<ExecuteResponse> {
		const runCommand = this.codeToolbox.getRunCommand(code, params);
		return this.executeCommand(runCommand, {
			env: params?.env,
			timeout,
		});
	}

	private prepareCommand(
		command: string,
		env?: Record<string, string>
	): string {
		const base64UserCmd = Buffer.from(command).toString('base64');
		let processedCommand = `echo '${base64UserCmd}' | base64 -d | sh`;

		if (env && Object.keys(env).length > 0) {
			const safeEnvExports = `${Object.entries(env)
				.map(([key, value]) => {
					const encodedValue = Buffer.from(value).toString('base64');
					return `export ${key}=$(echo '${encodedValue}' | base64 -d)`;
				})
				.join(';')};`;
			processedCommand = `${safeEnvExports} ${processedCommand}`;
		}

		return `sh -c "${processedCommand}"`;
	}

	public async createSession(sessionId: string): Promise<void> {
		await this.apiClient.createSession({
			sessionId,
		});
	}

	public async getSession(sessionId: string): Promise<SessionDto> {
		const response = await this.apiClient.getSession(sessionId);
		return response.data;
	}

	public async getSessionCommand(
		sessionId: string,
		commandId: string
	): Promise<CommandDto> {
		const response = await this.apiClient.getCommand(sessionId, commandId);
		return response.data;
	}

	public async executeSessionCommand(
		sessionId: string,
		req: SessionExecuteRequest,
		timeout?: number
	): Promise<SessionExecuteResponse> {
		const response = await this.apiClient.sessionExecuteCommand(
			sessionId,
			req,
			timeout ? { timeout: timeout * 1000 } : {}
		);

		if (response.data.output) {
			const outputBytes = new TextEncoder().encode(response.data.output);
			const demuxed = demuxLog(outputBytes);
			return {
				...response.data,
				stdout: demuxed.stdout,
				stderr: demuxed.stderr,
			};
		}

		return response.data;
	}

	public async getSessionCommandLogs(
		sessionId: string,
		commandId: string
	): Promise<SessionCommandLogsResponse>;
	public async getSessionCommandLogs(
		sessionId: string,
		commandId: string,
		onStdout: (chunk: string) => void,
		onStderr: (chunk: string) => void
	): Promise<void>;
	public async getSessionCommandLogs(
		sessionId: string,
		commandId: string,
		onStdout?: StreamHandler,
		onStderr?: StreamHandler
	): Promise<SessionCommandLogsResponse | void> {
		if (!onStdout && !onStderr) {
			const response = await this.apiClient.getCommandLogs(
				sessionId,
				commandId
			);
			const raw = response.data as unknown as string;
			const outputBytes = new TextEncoder().encode(raw || '');
			const demuxed = demuxLog(outputBytes);
			return {
				output: raw,
				stdout: demuxed.stdout,
				stderr: demuxed.stderr,
			};
		}

		await processStreamingResponse(
			() =>
				this.apiClient.getCommandLogs(sessionId, commandId, 'true', {
					responseType: 'stream',
				}),
			(chunk) => {
				const bytes = new TextEncoder().encode(chunk);
				const demuxed = demuxLog(bytes);
				if (demuxed.stdout && onStdout) onStdout(demuxed.stdout);
				if (demuxed.stderr && onStderr) onStderr(demuxed.stderr);
			},
			() =>
				this.getSessionCommand(sessionId, commandId).then(
					(res) => res.exitCode !== null && res.exitCode !== undefined
				)
		);
	}

	public async listSessions(): Promise<SessionDto[]> {
		const response = await this.apiClient.listSessions();
		return response.data;
	}

	public async deleteSession(sessionId: string): Promise<void> {
		await this.apiClient.deleteSession(sessionId);
	}
}

function demuxLog(data: Uint8Array): { stdout: string; stderr: string } {
	const outChunks: Uint8Array[] = [];
	const errChunks: Uint8Array[] = [];
	let state: 'none' | 'stdout' | 'stderr' = 'none';
	let i = 0;

	while (i < data.length) {
		const stdoutIdx = findSubarray(data, STDOUT_PREFIX_BYTES, i);
		const stderrIdx = findSubarray(data, STDERR_PREFIX_BYTES, i);

		let nextIdx = -1;
		let nextType: 'stdout' | 'stderr' | null = null;
		let nextLen = 0;

		if (stdoutIdx !== -1 && (stderrIdx === -1 || stdoutIdx < stderrIdx)) {
			nextIdx = stdoutIdx;
			nextType = 'stdout';
			nextLen = STDOUT_PREFIX_BYTES.length;
		} else if (stderrIdx !== -1) {
			nextIdx = stderrIdx;
			nextType = 'stderr';
			nextLen = STDERR_PREFIX_BYTES.length;
		}

		if (nextIdx === -1) {
			if (state === 'stdout') outChunks.push(data.subarray(i));
			else if (state === 'stderr') errChunks.push(data.subarray(i));
			break;
		}

		if (state === 'stdout' && nextIdx > i)
			outChunks.push(data.subarray(i, nextIdx));
		else if (state === 'stderr' && nextIdx > i)
			errChunks.push(data.subarray(i, nextIdx));

		i = nextIdx + nextLen;
		if (nextType) state = nextType;
	}

	const decoder = new TextDecoder('utf-8', { fatal: false });
	return {
		stdout: decoder.decode(concatBytes(outChunks)),
		stderr: decoder.decode(concatBytes(errChunks)),
	};
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
	if (chunks.length === 0) return new Uint8Array(0);
	if (chunks.length === 1) return chunks[0];
	const total = chunks.reduce((sum, c) => sum + c.length, 0);
	const result = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}
	return result;
}

function findSubarray(
	haystack: Uint8Array,
	needle: Uint8Array,
	from = 0
): number {
	const limit = haystack.length - needle.length;
	for (let i = from; i <= limit; i++) {
		let j = 0;
		for (; j < needle.length; j++) {
			if (haystack[i + j] !== needle[j]) break;
		}
		if (j === needle.length) return i;
	}
	return -1;
}
