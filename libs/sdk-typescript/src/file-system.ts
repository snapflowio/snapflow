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

import type { Readable } from 'node:stream';
import {
	createFileDownloadError,
	downloadFiles,
} from './file-system/file-download.js';
import { openDownloadStream } from './file-system/file-download-stream.js';
import { FileSystemOperations } from './file-system/file-system-operations.js';
import { uploadFileStream, uploadFiles } from './file-system/file-upload.js';
import type {
	DownloadStreamOptions,
	FileDownloadRequest,
	FileDownloadResponse,
	FileUpload,
	UploadSource,
	UploadStreamOptions,
} from './file-system.types.js';
import { DEFAULT_FILE_TRANSFER_TIMEOUT_SECONDS } from './utils/timeout.js';

export class FileSystem extends FileSystemOperations {
	public async downloadFile(
		remotePath: string,
		timeout?: number
	): Promise<Buffer>;
	public async downloadFile(
		remotePath: string,
		localPath: string,
		timeout?: number
	): Promise<void>;
	public async downloadFile(
		src: string,
		dst?: string | number,
		timeout: number = DEFAULT_FILE_TRANSFER_TIMEOUT_SECONDS
		// biome-ignore lint/suspicious/noConfusingVoidType: must stay compatible with the Promise<void> overload
	): Promise<Buffer | void> {
		const toLocalFile = typeof dst === 'string';
		const [response] = await this.downloadFiles(
			[{ source: src, destination: toLocalFile ? dst : undefined }],
			toLocalFile ? timeout : dst || timeout
		);

		if (response.error) {
			throw createFileDownloadError(response.error, response.errorDetails);
		}

		if (!toLocalFile) {
			return response.result as Buffer;
		}
	}

	public async downloadFileStream(
		remotePath: string,
		timeout?: number
	): Promise<Readable>;
	public async downloadFileStream(
		remotePath: string,
		options?: DownloadStreamOptions
	): Promise<Readable>;
	public async downloadFileStream(
		remotePath: string,
		timeoutOrOptions?: number | DownloadStreamOptions
	): Promise<Readable> {
		const options: DownloadStreamOptions =
			typeof timeoutOrOptions === 'number'
				? { timeout: timeoutOrOptions }
				: (timeoutOrOptions ?? {});
		return openDownloadStream(this.toolbox, remotePath, options);
	}

	public async downloadFiles(
		files: FileDownloadRequest[],
		timeoutSec: number = DEFAULT_FILE_TRANSFER_TIMEOUT_SECONDS
	): Promise<FileDownloadResponse[]> {
		return downloadFiles(this.toolbox, files, timeoutSec);
	}

	public async uploadFile(
		file: Buffer,
		remotePath: string,
		timeout?: number
	): Promise<void>;
	public async uploadFile(
		localPath: string,
		remotePath: string,
		timeout?: number
	): Promise<void>;
	public async uploadFile(
		src: string | Buffer,
		dst: string,
		timeout: number = DEFAULT_FILE_TRANSFER_TIMEOUT_SECONDS
	): Promise<void> {
		await this.uploadFiles([{ source: src, destination: dst }], timeout);
	}

	public async uploadFileStream(
		source: UploadSource,
		remotePath: string,
		options: UploadStreamOptions = {}
	): Promise<void> {
		await uploadFileStream(this.toolbox, source, remotePath, options);
	}

	public async uploadFiles(
		files: FileUpload[],
		timeout: number = DEFAULT_FILE_TRANSFER_TIMEOUT_SECONDS
	): Promise<void> {
		await uploadFiles(this.toolbox, files, timeout);
	}
}
