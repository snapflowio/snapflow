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

import { SnapflowError } from '../errors/snapflow-error.js';
import type {
	DownloadMetadata,
	FileDownloadErrorDetails,
} from '../file-system.types.js';
import { collectStreamBytes, toBuffer } from './binary.js';
import { parseMultipartWithFormData } from './multipart.js';
import { optionalString, parseJsonRecord } from './record.js';

export const DOWNLOAD_FILE_FIELD = 'file';
export const DOWNLOAD_ERROR_FIELD = 'error';
export const DOWNLOAD_CANCELLED_MESSAGE = 'Download cancelled';
export const CONTENT_TYPE_HEADER = 'content-type';

const JSON_CONTENT_TYPE_PATTERN = /application\/json/i;
const CANCELLED_ERROR_CODE = 'ERR_CANCELED';
const CANCELLED_ERROR_NAMES: ReadonlySet<string> = new Set([
	'CanceledError',
	'AbortError',
]);

type DownloadErrorPartResult = {
	message: string;
	errorDetails?: FileDownloadErrorDetails;
};

function parseDownloadErrorPart(
	data: Uint8Array,
	contentType: string
): DownloadErrorPartResult {
	const text = new TextDecoder().decode(data).trim();
	const payload = JSON_CONTENT_TYPE_PATTERN.test(contentType)
		? parseJsonRecord(text)
		: undefined;
	if (!payload) {
		return { message: text };
	}

	const message = optionalString(payload.message) ?? text;
	return {
		message,
		errorDetails: {
			message,
			statusCode:
				typeof payload.statusCode === 'number' ? payload.statusCode : undefined,
			errorCode: optionalString(payload.code),
		},
	};
}

export function assignDownloadErrorPart(
	metadata: DownloadMetadata,
	data: Uint8Array,
	contentType: string
): void {
	const { message, errorDetails } = parseDownloadErrorPart(data, contentType);
	metadata.error = message;
	metadata.errorDetails = errorDetails;
}

export async function processDownloadFilesResponseWithBuffered(
	body: ReadableStream<Uint8Array> | null,
	contentType: string,
	metadataMap: Map<string, DownloadMetadata>
): Promise<void> {
	const parts = await parseMultipartWithFormData(
		await collectStreamBytes(body),
		contentType
	);
	for (const part of parts) {
		const metadata = metadataMap.get(part.filename);
		if (!metadata) {
			throw new SnapflowError(`Received unexpected file "${part.filename}".`);
		}
		if (part.fieldName === DOWNLOAD_ERROR_FIELD) {
			assignDownloadErrorPart(metadata, part.data, part.contentType);
		} else if (part.fieldName === DOWNLOAD_FILE_FIELD) {
			metadata.result = toBuffer(part.data);
		}
	}
}

export function normalizeDownloadStreamError(error: unknown): unknown {
	const isCancelled =
		error instanceof Error &&
		(CANCELLED_ERROR_NAMES.has(error.name) ||
			('code' in error && error.code === CANCELLED_ERROR_CODE));
	return isCancelled ? new SnapflowError(DOWNLOAD_CANCELLED_MESSAGE) : error;
}
