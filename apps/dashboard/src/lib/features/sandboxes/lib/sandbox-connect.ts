/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { API_BASE_PATH } from '#lib/config/service-paths.ts';

const API_KEY_VARIABLE = 'SNAPFLOW_API_KEY';
const SDK_PACKAGE = '@snapflow/sdk';
const SSH_ACCESS_MINUTES = 60;

export interface SandboxConnectSnippet {
	id: string;
	label: string;
	code: string;
}

export function sandboxConnectSnippets(
	sandboxId: string,
	origin: string
): SandboxConnectSnippet[] {
	const apiUrl = new URL(API_BASE_PATH, origin).href;
	return [
		{
			id: 'api',
			label: 'REST API',
			code: `curl -H "Authorization: Bearer $${API_KEY_VARIABLE}" \\\n  ${apiUrl}/sandbox/${sandboxId}`,
		},
		{
			id: 'sdk',
			label: 'TypeScript SDK',
			code: [
				`import { Snapflow } from '${SDK_PACKAGE}';`,
				'',
				`const snapflow = new Snapflow({ apiUrl: '${apiUrl}' });`,
				`const sandbox = await snapflow.get('${sandboxId}');`,
				`const result = await sandbox.process.executeCommand('uname -a');`,
				'console.log(result.result);',
			].join('\n'),
		},
		{
			id: 'ssh',
			label: 'SSH',
			code: [
				`const access = await sandbox.createSshAccess(${SSH_ACCESS_MINUTES});`,
				'console.log(access.sshCommand);',
			].join('\n'),
		},
	];
}
