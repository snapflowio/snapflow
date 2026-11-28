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
import type { SetFilePermissionsData } from '@snapflow/toolbox-api-client';

export type FilePermissionsParams = Omit<
	SetFilePermissionsData['query'],
	'path'
>;

export interface FileUpload {
	source: string | Buffer;
	destination: string;
}

export interface FileDownloadRequest {
	source: string;
	destination?: string;
}

export interface FileDownloadErrorDetails {
	message: string;
	statusCode?: number;
	errorCode?: string;
}

export interface FileDownloadResponse {
	source: string;
	result?: Buffer | string;
	error?: string;
	errorDetails?: FileDownloadErrorDetails;
}

export interface DownloadMetadata {
	destination?: string;
	error?: string;
	errorDetails?: FileDownloadErrorDetails;
	result?: Buffer | string;
}

export type DownloadProgress = {
	bytesReceived: number;
	totalBytes?: number;
};

export type UploadProgress = {
	bytesSent: number;
};

export type DownloadStreamOptions = {
	onProgress?: (progress: DownloadProgress) => void;
	signal?: AbortSignal;
	timeout?: number;
};

export type UploadSource =
	| Buffer
	| Uint8Array
	| string
	| Readable
	| ReadableStream<Uint8Array>;

export type UploadStreamOptions = {
	onProgress?: (progress: UploadProgress) => void;
	signal?: AbortSignal;
	timeout?: number;
};
