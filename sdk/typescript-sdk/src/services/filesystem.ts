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
	FileInfo,
	FileSystemApi,
	Match,
	ReplaceRequest,
	ReplaceResult,
	SearchFilesResponse,
} from '@snapflow/toolbox-client';
import FormData from 'form-data';
import * as fs from 'fs';
import { Readable } from 'stream';
import { SnapflowError } from '../errors';
import { prefixRelativePath } from '../utils/path';

export interface FilePermissionsParams {
	readonly group?: string;
	readonly mode?: string;
	readonly owner?: string;
}

export interface FileUpload {
	readonly source: string | Buffer;
	readonly destination: string;
}

export interface FileDownloadRequest {
	readonly source: string;
	readonly destination?: string;
}

export interface FileOperationOptions {
	readonly timeout?: number;
}

export class FileSystem {
	constructor(
		private readonly apiClient: FileSystemApi,
		private readonly getRootDir: () => Promise<string>
	) {}

	public async createFolder(path: string, mode: string): Promise<void> {
		const response = await this.apiClient.createFolder(
			prefixRelativePath(await this.getRootDir(), path),
			mode
		);
		return response.data;
	}

	public async deleteFile(path: string): Promise<void> {
		const response = await this.apiClient.deleteFile(
			prefixRelativePath(await this.getRootDir(), path)
		);
		return response.data;
	}

	public async downloadFile(
		remotePath: string,
		options?: FileOperationOptions
	): Promise<Buffer>;
	public async downloadFile(
		remotePath: string,
		localPath: string,
		options?: FileOperationOptions
	): Promise<void>;
	public async downloadFile(
		src: string,
		dstOrOptions?: string | FileOperationOptions,
		options: FileOperationOptions = {}
	): Promise<Buffer | void> {
		const timeout = options.timeout ?? 30 * 60;
		const remotePath = prefixRelativePath(await this.getRootDir(), src);

		if (typeof dstOrOptions !== 'string') {
			const actualOptions = dstOrOptions ?? {};
			const actualTimeout = actualOptions.timeout ?? 30 * 60;
			const response = await this.apiClient.downloadFile(remotePath, {
				responseType: 'arraybuffer',
				timeout: actualTimeout * 1000,
			});
			const data = response.data as unknown;

			if (Buffer.isBuffer(data)) {
				return data;
			}

			if (data instanceof ArrayBuffer) {
				return Buffer.from(data);
			}

			return Buffer.from(await (data as Blob).arrayBuffer());
		}

		const localPath = dstOrOptions as string;
		const response = await this.apiClient.downloadFile(remotePath, {
			responseType: 'stream',
			timeout: timeout * 1000,
		});
		const writer = fs.createWriteStream(localPath);
		(response.data as any).pipe(writer);
		await new Promise<void>((resolve, reject) => {
			writer.on('finish', () => resolve());
			writer.on('error', (err) => reject(err));
		});
	}

	public async downloadFiles(
		files: FileDownloadRequest[],
		options: FileOperationOptions = {}
	): Promise<Array<Buffer | undefined>> {
		return Promise.all(
			files.map(({ source, destination }) => {
				if (destination) {
					return this.downloadFile(source, destination, options).then(
						() => undefined
					);
				}
				return this.downloadFile(source, options);
			})
		);
	}

	public async findFiles(path: string, pattern: string): Promise<Array<Match>> {
		const response = await this.apiClient.findInFiles(
			prefixRelativePath(await this.getRootDir(), path),
			pattern
		);
		return response.data;
	}

	public async getFileDetails(path: string): Promise<FileInfo> {
		const response = await this.apiClient.getFileInfo(
			prefixRelativePath(await this.getRootDir(), path)
		);
		return response.data;
	}

	public async listFiles(path: string): Promise<FileInfo[]> {
		const response = await this.apiClient.listFiles(
			prefixRelativePath(await this.getRootDir(), path)
		);
		return response.data;
	}

	public async moveFiles(source: string, destination: string): Promise<void> {
		const response = await this.apiClient.moveFile(
			prefixRelativePath(await this.getRootDir(), source),
			prefixRelativePath(await this.getRootDir(), destination)
		);
		return response.data;
	}

	public async replaceInFiles(
		files: string[],
		pattern: string,
		newValue: string
	): Promise<Array<ReplaceResult>> {
		for (let i = 0; i < files.length; i++) {
			files[i] = prefixRelativePath(await this.getRootDir(), files[i]);
		}

		const replaceRequest: ReplaceRequest = {
			files,
			newValue,
			pattern,
		};

		const response = await this.apiClient.replaceInFiles(replaceRequest);
		return response.data;
	}

	public async searchFiles(
		path: string,
		pattern: string
	): Promise<SearchFilesResponse> {
		const response = await this.apiClient.searchFiles(
			prefixRelativePath(await this.getRootDir(), path),
			pattern
		);
		return response.data;
	}

	public async setFilePermissions(
		path: string,
		permissions: FilePermissionsParams
	): Promise<void> {
		if (!permissions.owner || !permissions.group || !permissions.mode) {
			throw new SnapflowError(
				'owner, group, and mode are required for setting file permissions'
			);
		}

		const response = await this.apiClient.setFilePermissions(
			prefixRelativePath(await this.getRootDir(), path),
			permissions.owner,
			permissions.group,
			permissions.mode
		);
		return response.data;
	}

	public async uploadFile(
		file: Buffer,
		remotePath: string,
		options?: FileOperationOptions
	): Promise<void>;
	public async uploadFile(
		localPath: string,
		remotePath: string,
		options?: FileOperationOptions
	): Promise<void>;
	public async uploadFile(
		src: string | Buffer,
		dst: string,
		options: FileOperationOptions = {}
	): Promise<void> {
		await this.uploadFiles([{ source: src, destination: dst }], options);
	}

	public async uploadFiles(
		files: FileUpload[],
		options: FileOperationOptions = {}
	): Promise<void> {
		const timeout = options.timeout ?? 30 * 60;
		const form = new FormData();
		const rootDir = await this.getRootDir();

		files.forEach(({ source, destination }, i) => {
			const dst = prefixRelativePath(rootDir, destination);
			form.append(`files[${i}].path`, dst);
			const stream =
				typeof source === 'string'
					? fs.createReadStream(source)
					: Readable.from(source);
			form.append(`files[${i}].file`, stream as any, dst);
		});

		await this.apiClient.bulkUploadFiles({
			data: form,
			maxRedirects: 0,
			timeout: timeout * 1000,
		});
	}
}
