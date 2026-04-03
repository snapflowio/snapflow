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
	CompletionList,
	LspApi,
	LspSymbol,
} from '@snapflow/toolbox-client';
import { SnapflowError } from '../errors';
import { prefixRelativePath } from '../utils/path';

export enum LspLanguageId {
	TYPESCRIPT = 'typescript',
}

export interface Position {
	readonly line: number;
	readonly character: number;
}

export class LspServer {
	constructor(
		private readonly languageId: LspLanguageId,
		private readonly pathToProject: string,
		private readonly apiClient: LspApi
	) {
		this.validateLanguageId();
	}

	private validateLanguageId(): void {
		if (!Object.values(LspLanguageId).includes(this.languageId)) {
			throw new SnapflowError(
				`Invalid languageId: ${this.languageId}. Supported values are: ${Object.values(LspLanguageId).join(', ')}`
			);
		}
	}

	public async start(): Promise<void> {
		await this.apiClient.lspStart({
			languageId: this.languageId,
			pathToProject: this.pathToProject,
		});
	}

	public async stop(): Promise<void> {
		await this.apiClient.lspStop({
			languageId: this.languageId,
			pathToProject: this.pathToProject,
		});
	}

	public async didOpen(path: string): Promise<void> {
		await this.apiClient.lspDidOpen({
			languageId: this.languageId,
			pathToProject: this.pathToProject,
			uri: this.createFileUri(path),
		});
	}

	public async didClose(path: string): Promise<void> {
		await this.apiClient.lspDidClose({
			languageId: this.languageId,
			pathToProject: this.pathToProject,
			uri: this.createFileUri(path),
		});
	}

	private createFileUri(path: string): string {
		return 'file://' + prefixRelativePath(this.pathToProject, path);
	}

	public async documentSymbols(path: string): Promise<LspSymbol[]> {
		const response = await this.apiClient.lspDocumentSymbols(
			this.languageId,
			this.pathToProject,
			this.createFileUri(path)
		);
		return response.data;
	}

	public async workspaceSymbols(query: string): Promise<LspSymbol[]> {
		const response = await this.apiClient.lspWorkspaceSymbols(
			query,
			this.languageId,
			this.pathToProject
		);
		return response.data;
	}

	public async completions(
		path: string,
		position: Position
	): Promise<CompletionList> {
		const response = await this.apiClient.lspCompletions({
			languageId: this.languageId,
			pathToProject: this.pathToProject,
			uri: this.createFileUri(path),
			position,
		});
		return response.data;
	}
}
