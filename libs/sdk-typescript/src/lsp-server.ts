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
	type CompletionList,
	completions,
	didClose,
	didOpen,
	documentSymbols,
	type LspServerRequest,
	type LspSymbol,
	start,
	stop,
	workspaceSymbols,
} from '@snapflow/toolbox-api-client';
import type { ToolboxClientProvider } from './edge-toolbox-session.js';
import { SnapflowValidationError } from './errors/snapflow-error.js';

const FILE_URI_SCHEME = 'file://';

export enum LspLanguageId {
	PYTHON = 'python',
	TYPESCRIPT = 'typescript',
	JAVASCRIPT = 'javascript',
}

export type Position = {
	line: number;
	character: number;
};

export class LspServer {
	constructor(
		private readonly languageId: LspLanguageId,
		private readonly pathToProject: string,
		private readonly toolbox: ToolboxClientProvider
	) {
		if (!Object.values(LspLanguageId).includes(this.languageId)) {
			throw new SnapflowValidationError(
				`Invalid languageId: ${this.languageId}. Supported values are: ${Object.values(LspLanguageId).join(', ')}`
			);
		}
	}

	public async start(): Promise<void> {
		await start({ client: await this.toolbox(), body: this.serverRequest() });
	}

	public async stop(): Promise<void> {
		await stop({ client: await this.toolbox(), body: this.serverRequest() });
	}

	public async didOpen(path: string): Promise<void> {
		await didOpen({
			client: await this.toolbox(),
			body: { ...this.serverRequest(), uri: toFileUri(path) },
		});
	}

	public async didClose(path: string): Promise<void> {
		await didClose({
			client: await this.toolbox(),
			body: { ...this.serverRequest(), uri: toFileUri(path) },
		});
	}

	public async documentSymbols(path: string): Promise<LspSymbol[]> {
		const response = await documentSymbols({
			client: await this.toolbox(),
			query: { ...this.serverRequest(), uri: toFileUri(path) },
		});
		return response.data;
	}

	public async sandboxSymbols(query: string): Promise<LspSymbol[]> {
		const response = await workspaceSymbols({
			client: await this.toolbox(),
			query: { ...this.serverRequest(), query },
		});
		return response.data;
	}

	public async completions(
		path: string,
		position: Position
	): Promise<CompletionList> {
		const response = await completions({
			client: await this.toolbox(),
			body: {
				...this.serverRequest(),
				uri: toFileUri(path),
				position: {
					line: position.line,
					character: position.character,
				},
			},
		});
		return response.data;
	}

	private serverRequest(): LspServerRequest {
		return {
			languageId: this.languageId,
			pathToProject: this.pathToProject,
		};
	}
}

function toFileUri(path: string): string {
	return `${FILE_URI_SCHEME}${path}`;
}
