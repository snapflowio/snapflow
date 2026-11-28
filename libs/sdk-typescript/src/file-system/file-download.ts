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

import { downloadFiles as requestFileDownloads } from '@snapflow/toolbox-api-client';
import * as pathe from 'pathe';
import type { ToolboxAccess } from '../edge-toolbox-session.js';
import {
	createSnapflowError,
	SnapflowError,
} from '../errors/snapflow-error.js';
import type {
	DownloadMetadata,
	FileDownloadErrorDetails,
	FileDownloadRequest,
	FileDownloadResponse,
} from '../file-system.types.js';
import { processDownloadFilesResponseWithBusboy } from '../utils/busboy-download.js';
import {
	CONTENT_TYPE_HEADER,
	processDownloadFilesResponseWithBuffered,
} from '../utils/download-response.js';
import { requestSignal } from '../utils/http.js';
import { nodeBuiltin } from '../utils/import.js';
import { RUNTIME, Runtime } from '../utils/runtime.js';

const MISSING_FILE_DATA_ERROR = 'No data received for this file';

export function isBufferedDownloadRuntime(): boolean {
	return RUNTIME === Runtime.BROWSER || RUNTIME === Runtime.SERVERLESS;
}

export function createFileDownloadError(
	error: string,
	errorDetails?: FileDownloadErrorDetails
): SnapflowError {
	if (!errorDetails) {
		return new SnapflowError(error);
	}

	return createSnapflowError(
		errorDetails.message,
		errorDetails.statusCode,
		undefined,
		errorDetails.errorCode
	);
}

async function prepareDestinations(files: FileDownloadRequest[]) {
	for (const file of files) {
		if (file.destination) {
			const fs = nodeBuiltin(
				'node:fs',
				'Downloading files to local files is not supported: '
			);
			await fs.promises.mkdir(pathe.dirname(file.destination), {
				recursive: true,
			});
		}
	}
}

function toDownloadResponse(
	file: FileDownloadRequest,
	metadata: DownloadMetadata | undefined
): FileDownloadResponse {
	const error =
		metadata?.error ||
		(!metadata?.result ? MISSING_FILE_DATA_ERROR : undefined);

	return {
		source: file.source,
		result: error ? undefined : metadata?.result,
		error,
		errorDetails: error ? metadata?.errorDetails : undefined,
	};
}

export async function downloadFiles(
	toolbox: ToolboxAccess,
	files: FileDownloadRequest[],
	timeoutSec: number
): Promise<FileDownloadResponse[]> {
	if (files.length === 0) return [];

	const isBufferedRuntime = isBufferedDownloadRuntime();

	const metadataMap = new Map<string, DownloadMetadata>(
		files.map((file) => [file.source, { destination: file.destination }])
	);
	await prepareDestinations(files);

	const { response } = await requestFileDownloads({
		client: await toolbox.client(),
		body: { paths: files.map((file) => file.source) },
		parseAs: 'stream',
		signal: requestSignal(timeoutSec),
	});

	const contentType = response.headers.get(CONTENT_TYPE_HEADER) ?? '';

	if (isBufferedRuntime) {
		await processDownloadFilesResponseWithBuffered(
			response.body,
			contentType,
			metadataMap
		);
	} else {
		await processDownloadFilesResponseWithBusboy(
			response.body,
			contentType,
			metadataMap
		);
	}

	return files.map((file) =>
		toDownloadResponse(file, metadataMap.get(file.source))
	);
}
