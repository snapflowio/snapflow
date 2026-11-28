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
import { SnapflowError } from '../errors/snapflow-error.js';
import type { UploadProgress, UploadSource } from '../file-system.types.js';
import { nodeBuiltin } from './import.js';
import { createChunkTap } from './stream-tap.js';

export const UPLOAD_IMPORT_ERROR_PREFIX = 'Uploading files is not supported: ';
export const LOCAL_UPLOAD_IMPORT_ERROR_PREFIX =
	'Uploading file from local file system is not supported: ';

export function createAbortError(remotePath: string): SnapflowError {
	return new SnapflowError(`Upload cancelled: ${remotePath}`);
}

export function coerceUploadSource(source: UploadSource): Readable {
	const stream = nodeBuiltin('node:stream', UPLOAD_IMPORT_ERROR_PREFIX);
	if (source instanceof Uint8Array) {
		return stream.Readable.from(Buffer.from(source));
	}
	if (typeof source === 'string') {
		const fs = nodeBuiltin('node:fs', LOCAL_UPLOAD_IMPORT_ERROR_PREFIX);
		return fs.createReadStream(source);
	}
	if (source instanceof stream.Readable) {
		return source;
	}
	return stream.Readable.from(source, { objectMode: false });
}

export function wrapWithUploadProgress(
	source: Readable,
	onProgress: ((progress: UploadProgress) => void) | undefined,
	signal?: AbortSignal
): Readable {
	if (!onProgress && !signal) return source;

	const { Transform, pipeline } = nodeBuiltin(
		'node:stream',
		UPLOAD_IMPORT_ERROR_PREFIX
	);

	let bytesSent = 0;
	const tracker = createChunkTap(Transform, (chunk) => {
		bytesSent += chunk.length;
		onProgress?.({ bytesSent });
	});

	pipeline(source, tracker, (err) => {
		if (!err) return;
		if (!source.destroyed) source.destroy(err);
		if (!tracker.destroyed) tracker.destroy(err);
	});

	if (signal) {
		const onAbort = () => {
			const abortError = new Error('aborted');
			if (!source.destroyed) source.destroy(abortError);
			if (!tracker.destroyed) tracker.destroy(abortError);
		};

		if (signal.aborted) {
			queueMicrotask(onAbort);
		} else {
			signal.addEventListener('abort', onAbort, { once: true });
			tracker.on('close', () => signal.removeEventListener('abort', onAbort));
		}
	}

	return tracker;
}
