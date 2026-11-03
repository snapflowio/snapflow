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

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import packageJson from '../../package.json' with { type: 'json' };
import { SnapflowAuthenticationError } from '../errors/snapflow-error.js';
import { resolveClientConfig, SDK_VERSION } from './client-config.js';

const API_KEY_VARIABLE = 'SNAPFLOW_API_KEY';
const API_URL_VARIABLE = 'SNAPFLOW_API_URL';

describe('resolveClientConfig', () => {
	const originalDirectory = process.cwd();
	let directory: string;

	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'snapflow-sdk-config-'));
	});

	afterEach(async () => {
		vi.unstubAllEnvs();
		process.chdir(originalDirectory);
		await rm(directory, { recursive: true, force: true });
	});

	it('reads configuration from environment variables', () => {
		vi.stubEnv(API_KEY_VARIABLE, 'environment-key');
		vi.stubEnv(API_URL_VARIABLE, 'https://api.snapflow.test');

		expect(resolveClientConfig()).toEqual({
			apiKey: 'environment-key',
			apiUrl: 'https://api.snapflow.test',
		});
	});

	it('does not read .env files', async () => {
		vi.stubEnv(API_KEY_VARIABLE, undefined);
		vi.stubEnv(API_URL_VARIABLE, undefined);
		await writeFile(
			join(directory, '.env'),
			`${API_KEY_VARIABLE}=file-key\n${API_URL_VARIABLE}=https://file.snapflow.test\n`
		);
		process.chdir(directory);

		expect(() => resolveClientConfig()).toThrow(SnapflowAuthenticationError);
	});
});

describe('SDK_VERSION', () => {
	it('matches the package version', () => {
		expect(SDK_VERSION).toBe(packageJson.version);
	});
});
