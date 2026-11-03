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
	createFolder,
	deleteFile,
	type FileInfo,
	findInFiles,
	getFileInfo,
	listFiles,
	type Match,
	moveFile,
	type ReplaceResult,
	replaceInFiles,
	type SearchFilesResponse,
	searchFiles,
	setFilePermissions,
} from '@snapflow/toolbox-api-client';
import type { ToolboxAccess } from '../edge-toolbox-session.js';
import type { FilePermissionsParams } from '../file-system.types.js';

export abstract class FileSystemOperations {
	constructor(protected readonly toolbox: ToolboxAccess) {}

	public async createFolder(path: string, mode: string): Promise<void> {
		await createFolder({
			client: await this.toolbox.client(),
			query: { path, mode },
		});
	}

	public async deleteFile(path: string, recursive?: boolean): Promise<void> {
		await deleteFile({
			client: await this.toolbox.client(),
			query: { path, recursive },
		});
	}

	public async findFiles(path: string, pattern: string): Promise<Match[]> {
		const response = await findInFiles({
			client: await this.toolbox.client(),
			query: { path, pattern },
		});
		return response.data;
	}

	public async getFileDetails(path: string): Promise<FileInfo> {
		const response = await getFileInfo({
			client: await this.toolbox.client(),
			query: { path },
		});
		return response.data;
	}

	public async listFiles(path: string): Promise<FileInfo[]> {
		const response = await listFiles({
			client: await this.toolbox.client(),
			query: { path },
		});
		return response.data;
	}

	public async moveFiles(source: string, destination: string): Promise<void> {
		await moveFile({
			client: await this.toolbox.client(),
			query: { source, destination },
		});
	}

	public async replaceInFiles(
		files: string[],
		pattern: string,
		newValue: string
	): Promise<ReplaceResult[]> {
		const response = await replaceInFiles({
			client: await this.toolbox.client(),
			body: { files, newValue, pattern },
		});
		return response.data;
	}

	public async searchFiles(
		path: string,
		pattern: string
	): Promise<SearchFilesResponse> {
		const response = await searchFiles({
			client: await this.toolbox.client(),
			query: { path, pattern },
		});
		return response.data;
	}

	public async setFilePermissions(
		path: string,
		permissions: FilePermissionsParams
	): Promise<void> {
		await setFilePermissions({
			client: await this.toolbox.client(),
			query: { path, ...permissions },
		});
	}
}
