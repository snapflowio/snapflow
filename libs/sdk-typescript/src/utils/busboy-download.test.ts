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

import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DownloadMetadata } from '../file-system.types.js';
import { processDownloadFilesResponseWithBusboy } from './busboy-download.js';

const BOUNDARY = 'snapflow-boundary';
const CONTENT_TYPE = `multipart/form-data; boundary=${BOUNDARY}`;
const SOURCE = '/home/sandbox/data.bin';
const MISSING_SOURCE = '/home/sandbox/missing.txt';

function partHeader(field: string, filename: string, type: string): string {
	return `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`;
}

function body(chunks: string[], failure?: Error): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	const pending = [...chunks];
	return new ReadableStream<Uint8Array>({
		pull(controller) {
			const next = pending.shift();
			if (next !== undefined) {
				controller.enqueue(encoder.encode(next));
			} else if (failure) {
				controller.error(failure);
			} else {
				controller.close();
			}
		},
	});
}

describe('processDownloadFilesResponseWithBusboy', () => {
	let directory: string;

	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'snapflow-sdk-download-'));
	});

	afterEach(async () => {
		await rm(directory, { recursive: true, force: true });
	});

	it('writes file parts to their destination', async () => {
		const destination = join(directory, 'data.bin');
		const metadata: DownloadMetadata = { destination };

		await processDownloadFilesResponseWithBusboy(
			body([
				partHeader('file', SOURCE, 'application/octet-stream'),
				'payload',
				`\r\n--${BOUNDARY}--\r\n`,
			]),
			CONTENT_TYPE,
			new Map([[SOURCE, metadata]])
		);

		expect(metadata).toEqual({ destination, result: destination });
		await expect(readFile(destination, 'utf-8')).resolves.toBe('payload');
	});

	it('buffers file parts and maps error parts', async () => {
		const file: DownloadMetadata = {};
		const missing: DownloadMetadata = {};

		await processDownloadFilesResponseWithBusboy(
			body([
				partHeader('file', SOURCE, 'application/octet-stream'),
				'payload',
				`\r\n${partHeader('error', MISSING_SOURCE, 'application/json; charset=utf-8')}`,
				JSON.stringify({
					statusCode: 404,
					code: 'FILE_NOT_FOUND',
					message: 'file not found',
				}),
				`\r\n--${BOUNDARY}--\r\n`,
			]),
			CONTENT_TYPE,
			new Map([
				[SOURCE, file],
				[MISSING_SOURCE, missing],
			])
		);

		expect(file.result?.toString()).toBe('payload');
		expect(missing).toEqual({
			error: 'file not found',
			errorDetails: {
				message: 'file not found',
				statusCode: 404,
				errorCode: 'FILE_NOT_FOUND',
			},
		});
	});

	it('rejects and removes the partial file when the response fails mid-file', async () => {
		const destination = join(directory, 'data.bin');
		const metadata: DownloadMetadata = { destination };
		const failure = new Error('connection reset');

		await expect(
			processDownloadFilesResponseWithBusboy(
				body(
					[partHeader('file', SOURCE, 'application/octet-stream'), 'partial'],
					failure
				),
				CONTENT_TYPE,
				new Map([[SOURCE, metadata]])
			)
		).rejects.toBe(failure);

		expect(metadata.error).toContain('connection reset');
		expect(metadata.result).toBeUndefined();
		expect(existsSync(destination)).toBe(false);
	});
});
