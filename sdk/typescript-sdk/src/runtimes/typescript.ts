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

import type { CodeRunParams } from '../services/process';

export interface SandboxCodeToolbox {
	getRunCommand(code: string, params?: CodeRunParams): string;
}

export class SandboxTsCodeToolbox implements SandboxCodeToolbox {
	private static readonly TS_NODE_CONFIG = '"{\\"module\\":\\"CommonJS\\"}"';
	private static readonly FILTER_PATTERN = '"npm notice"';

	public getRunCommand(code: string, params?: CodeRunParams): string {
		const base64Code = Buffer.from(code).toString('base64');
		const argv = params?.argv?.length ? params.argv.join(' ') : '';

		return [
			'sh -c',
			`'echo ${base64Code}`,
			'| base64 --decode',
			`| npx ts-node -O ${SandboxTsCodeToolbox.TS_NODE_CONFIG}`,
			'-e "$(cat)" x',
			argv,
			'2>&1',
			`| grep -vE ${SandboxTsCodeToolbox.FILTER_PATTERN}'`,
		].join(' ');
	}
}
