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

import type { Readable, Transform } from 'node:stream';
import { downloadFiles } from '@snapflow/toolbox-api-client';
import type { ToolboxAccess } from '../edge-toolbox-session.js';
import { SnapflowError } from '../errors/snapflow-error.js';
import type {
	DownloadMetadata,
	DownloadProgress,
	DownloadStreamOptions,
} from '../file-system.types.js';
import { processDownloadFilesResponseWithBusboy } from '../utils/busboy-download.js';
import {
	CONTENT_TYPE_HEADER,
	DOWNLOAD_CANCELLED_MESSAGE,
} from '../utils/download-response.js';
import { requestSignal } from '../utils/http.js';
import { nodeBuiltin } from '../utils/import.js';
import { createChunkTap } from '../utils/stream-tap.js';
import { DEFAULT_FILE_TRANSFER_TIMEOUT_SECONDS } from '../utils/timeout.js';
import {
	createFileDownloadError,
	isBufferedDownloadRuntime,
} from './file-download.js';

const ABORT_ERROR_NAME = 'AbortError';

const createDownloadCancelledError = () =>
	new SnapflowError(DOWNLOAD_CANCELLED_MESSAGE);

function isCanceledError(err: unknown): boolean {
	return err instanceof Error && err.name === ABORT_ERROR_NAME;
}

function createAbortForwarder(signal?: AbortSignal) {
	let target: Readable | null = null;
	const forward = () => {
		if (target && !target.destroyed && !target.readableEnded) {
			target.destroy(createDownloadCancelledError());
		}
	};
	const remove = () => signal?.removeEventListener('abort', forward);
	signal?.addEventListener('abort', forward, { once: true });

	const attach = (stream: Readable) => {
		target = stream;
		stream.once('end', remove);
		stream.once('error', remove);
		stream.once('close', remove);
		if (signal?.aborted) queueMicrotask(forward);
	};
	return { attach, remove };
}

function trackDownloadProgress(
	TransformClass: typeof Transform,
	fileStream: Readable,
	onProgress: (progress: DownloadProgress) => void,
	totalBytes: number | undefined
): Readable {
	let bytesReceived = 0;
	const progress = createChunkTap(TransformClass, (chunk) => {
		bytesReceived += chunk.length;
		onProgress({ bytesReceived, totalBytes });
	});
	fileStream.pipe(progress);
	let fileStreamEnded = false;
	fileStream.once('end', () => {
		fileStreamEnded = true;
	});
	fileStream.on('error', (err: Error) => {
		if (fileStreamEnded) return;
		if (!progress.destroyed) progress.destroy(err);
	});
	fileStream.once('close', () => {
		if (!progress.writableFinished && !progress.destroyed) {
			progress.end();
		}
	});
	return progress;
}

export async function openDownloadStream(
	toolbox: ToolboxAccess,
	remotePath: string,
	options: DownloadStreamOptions
): Promise<Readable> {
	const timeout = options.timeout ?? DEFAULT_FILE_TRANSFER_TIMEOUT_SECONDS;
	if (isBufferedDownloadRuntime()) {
		throw new SnapflowError(
			'downloadFileStream is not supported in browser or serverless environments. Use downloadFile instead.'
		);
	}

	if (options.signal?.aborted) {
		throw createDownloadCancelledError();
	}

	const { Transform } = nodeBuiltin(
		'node:stream',
		'downloadFileStream progress tracking is not supported: '
	);

	const abortForwarder = createAbortForwarder(options.signal);
	const toStreamError = (err: unknown) =>
		options.signal?.aborted || isCanceledError(err)
			? createDownloadCancelledError()
			: err;

	let response: Response;
	try {
		response = (
			await downloadFiles({
				client: await toolbox.client(),
				body: { paths: [remotePath] },
				parseAs: 'stream',
				signal: requestSignal(timeout, options.signal),
			})
		).response;
	} catch (err) {
		abortForwarder.remove();
		throw toStreamError(err);
	}

	const metadataMap = new Map<string, DownloadMetadata>([[remotePath, {}]]);

	return new Promise<Readable>((resolve, reject) => {
		let resolvedStream: Readable | null = null;

		const rejectBeforeStreaming = (error: unknown) => {
			abortForwarder.remove();
			reject(error);
		};

		processDownloadFilesResponseWithBusboy(
			response.body,
			response.headers.get(CONTENT_TYPE_HEADER) ?? '',
			metadataMap,
			(fileStream, totalBytes) => {
				const downloadStream = options.onProgress
					? trackDownloadProgress(
							Transform,
							fileStream,
							options.onProgress,
							totalBytes
						)
					: fileStream;
				resolvedStream = downloadStream;
				abortForwarder.attach(downloadStream);
				resolve(downloadStream);
			}
		)
			.then(() => {
				if (resolvedStream) return;
				const metadata = metadataMap.get(remotePath);
				rejectBeforeStreaming(
					metadata?.error
						? createFileDownloadError(metadata.error, metadata.errorDetails)
						: new SnapflowError(`No file data received for: ${remotePath}`)
				);
			})
			.catch((err) => {
				const normalizedError = toStreamError(err);
				if (!resolvedStream) {
					rejectBeforeStreaming(normalizedError);
					return;
				}
				if (resolvedStream.destroyed || resolvedStream.readableEnded) {
					return;
				}
				resolvedStream.destroy(
					normalizedError instanceof Error
						? normalizedError
						: new Error(String(normalizedError))
				);
			});
	});
}
