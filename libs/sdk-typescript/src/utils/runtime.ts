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

declare global {
	var Deno:
		| {
				env: {
					get(name: string): string | undefined;
				};
		  }
		| undefined;

	var Bun: { version: string } | undefined;

	var WebSocketPair: unknown;
}

export enum Runtime {
	NODE = 'node',
	DENO = 'deno',
	BUN = 'bun',
	BROWSER = 'browser',
	SERVERLESS = 'serverless',
	UNKNOWN = 'unknown',
}

export function readEnvironmentVariable(name: string): string | undefined {
	const environment = typeof process === 'undefined' ? undefined : process.env;
	return environment ? environment[name] : globalThis.Deno?.env.get(name);
}

function isServerlessRuntime(): boolean {
	const env = readEnvironmentVariable;
	return (
		typeof globalThis.WebSocketPair === 'function' ||
		env('CF_PAGES') === '1' ||
		env('AWS_EXECUTION_ENV')?.startsWith('AWS_Lambda') === true ||
		env('LAMBDA_TASK_ROOT') !== undefined ||
		env('AWS_SAM_LOCAL') === 'true' ||
		env('FUNCTIONS_WORKER_RUNTIME') !== undefined ||
		(env('FUNCTION_TARGET') !== undefined &&
			env('FUNCTION_SIGNATURE_TYPE') !== undefined) ||
		env('VERCEL') === '1' ||
		env('SITE_NAME') !== undefined
	);
}

function detectRuntime(): Runtime {
	if (globalThis.Deno !== undefined) return Runtime.DENO;
	if (globalThis.Bun?.version) return Runtime.BUN;
	if (isServerlessRuntime()) return Runtime.SERVERLESS;
	if (typeof window !== 'undefined') return Runtime.BROWSER;
	if (typeof process !== 'undefined' && process.versions?.node) {
		return Runtime.NODE;
	}
	return Runtime.UNKNOWN;
}

export const RUNTIME = detectRuntime();
