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

import type { Client } from '@snapflow/api-client/client';
import { CodeInterpreter } from '../code-interpreter.js';
import { ComputerUse } from '../computer-use.js';
import { createDesktopLink } from '../desktop-link.js';
import { EdgeToolboxSession } from '../edge-toolbox-session.js';
import { FileSystem } from '../file-system.js';
import { Git } from '../git.js';
import { Process } from '../process.js';
import { SDK_VERSION } from '../snapflow/client-config.js';

export interface SandboxServicesParams {
	sandboxId: string;
	language?: string;
	client: Client;
}

export interface SandboxServices {
	fs: FileSystem;
	git: Git;
	process: Process;
	codeInterpreter: CodeInterpreter;
	computerUse: ComputerUse;
	toolbox: EdgeToolboxSession;
}

export function createSandboxServices({
	sandboxId,
	language,
	client,
}: SandboxServicesParams): SandboxServices {
	const toolbox = new EdgeToolboxSession(sandboxId, client, SDK_VERSION);

	return {
		fs: new FileSystem(toolbox),
		git: new Git(toolbox.client),
		process: new Process(toolbox, language),
		codeInterpreter: new CodeInterpreter(toolbox),
		computerUse: new ComputerUse(toolbox.client, (options) =>
			createDesktopLink({ sandboxId, client }, options)
		),
		toolbox,
	};
}
