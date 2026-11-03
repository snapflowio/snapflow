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
import type { UploadFilesData } from '@snapflow/toolbox-api-client';
import type { ToolboxAccess } from '../edge-toolbox-session.js';
import { SnapflowError } from '../errors/snapflow-error.js';
import type {
	FileUpload,
	UploadSource,
	UploadStreamOptions,
} from '../file-system.types.js';
import { requestSignal } from '../utils/http.js';
import { nodeBuiltin } from '../utils/import.js';
import { RUNTIME, Runtime } from '../utils/runtime.js';
import { DEFAULT_FILE_TRANSFER_TIMEOUT_SECONDS } from '../utils/timeout.js';
import {
	coerceUploadSource,
	createAbortError,
	LOCAL_UPLOAD_IMPORT_ERROR_PREFIX,
	UPLOAD_IMPORT_ERROR_PREFIX,
	wrapWithUploadProgress,
} from '../utils/upload-source.js';

const BULK_UPLOAD_URL: UploadFilesData['url'] = '/files/bulk-upload';
const OCTET_STREAM_CONTENT_TYPE = 'application/octet-stream';
const MULTIPART_BOUNDARY_PREFIX = 'snapflow-upload-';
const MULTIPART_LINE_BREAK = '\r\n';
const STREAMING_REQUEST_INIT = { duplex: 'half' } as const;
const UPLOAD_RESPONSE_PARSE_MODE = 'text';
const UPLOAD_REDIRECT_MODE: RequestRedirect = 'error';
const QUOTE_PATTERN = /"/g;
const ESCAPED_QUOTE = '%22';

function isWebUploadRuntime(): boolean {
	return (
		RUNTIME === Runtime.DENO ||
		RUNTIME === Runtime.BROWSER ||
		RUNTIME === Runtime.SERVERLESS
	);
}

function uploadFieldName(index: number, field: 'path' | 'file'): string {
	return `files[${index}].${field}`;
}

async function toUploadBlob(source: Uint8Array | string): Promise<Blob> {
	if (typeof source === 'string') {
		const fs = nodeBuiltin('node:fs', LOCAL_UPLOAD_IMPORT_ERROR_PREFIX);
		return fs.openAsBlob(source, { type: OCTET_STREAM_CONTENT_TYPE });
	}
	return new Blob([source.slice()], { type: OCTET_STREAM_CONTENT_TYPE });
}

function multipartFilePreamble(boundary: string, remotePath: string): string {
	const filename = remotePath.replace(QUOTE_PATTERN, ESCAPED_QUOTE);
	return [
		`--${boundary}`,
		`Content-Disposition: form-data; name="${uploadFieldName(0, 'path')}"`,
		'',
		remotePath,
		`--${boundary}`,
		`Content-Disposition: form-data; name="${uploadFieldName(0, 'file')}"; filename="${filename}"`,
		`Content-Type: ${OCTET_STREAM_CONTENT_TYPE}`,
		'',
		'',
	].join(MULTIPART_LINE_BREAK);
}

async function* multipartFileBody(
	boundary: string,
	remotePath: string,
	file: Readable
): AsyncGenerator<Uint8Array> {
	const encoder = new TextEncoder();
	yield encoder.encode(multipartFilePreamble(boundary, remotePath));
	for await (const chunk of file) {
		yield chunk as Uint8Array;
	}
	yield encoder.encode(
		`${MULTIPART_LINE_BREAK}--${boundary}--${MULTIPART_LINE_BREAK}`
	);
}

export async function uploadFileStream(
	toolbox: ToolboxAccess,
	source: UploadSource,
	remotePath: string,
	options: UploadStreamOptions
): Promise<void> {
	if (isWebUploadRuntime()) {
		throw new SnapflowError(
			'uploadFileStream is not supported in browser, Deno, or serverless runtimes. Use uploadFile instead.'
		);
	}

	if (options.signal?.aborted) {
		throw createAbortError(remotePath);
	}

	const timeout = options.timeout ?? DEFAULT_FILE_TRANSFER_TIMEOUT_SECONDS;
	const tracked = wrapWithUploadProgress(
		coerceUploadSource(source),
		options.onProgress,
		options.signal
	);
	const stream = nodeBuiltin('node:stream', UPLOAD_IMPORT_ERROR_PREFIX);
	const boundary = `${MULTIPART_BOUNDARY_PREFIX}${crypto.randomUUID()}`;
	const body = stream.Readable.toWeb(
		stream.Readable.from(multipartFileBody(boundary, remotePath, tracked))
	);

	try {
		const client = await toolbox.client();
		await client.post({
			url: BULK_UPLOAD_URL,
			body,
			headers: {
				'Content-Type': `multipart/form-data; boundary=${boundary}`,
			},
			...STREAMING_REQUEST_INIT,
			parseAs: UPLOAD_RESPONSE_PARSE_MODE,
			redirect: UPLOAD_REDIRECT_MODE,
			signal: requestSignal(timeout, options.signal),
		});
	} catch (err) {
		if (options.signal?.aborted) {
			throw createAbortError(remotePath);
		}
		throw err;
	}
}

export async function uploadFiles(
	toolbox: ToolboxAccess,
	files: FileUpload[],
	timeout: number
): Promise<void> {
	const form = new FormData();

	for (const [index, { source, destination }] of files.entries()) {
		form.append(uploadFieldName(index, 'path'), destination);
		form.append(
			uploadFieldName(index, 'file'),
			await toUploadBlob(source),
			destination
		);
	}

	const client = await toolbox.client();
	await client.post({
		url: BULK_UPLOAD_URL,
		body: form,
		parseAs: UPLOAD_RESPONSE_PARSE_MODE,
		redirect: UPLOAD_REDIRECT_MODE,
		signal: requestSignal(timeout),
	});
}
