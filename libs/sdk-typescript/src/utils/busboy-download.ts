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
import busboy from 'busboy';
import { SnapflowError } from '../errors/snapflow-error.js';
import type { DownloadMetadata } from '../file-system.types.js';
import {
	assignDownloadErrorPart,
	CONTENT_TYPE_HEADER,
	DOWNLOAD_ERROR_FIELD,
	DOWNLOAD_FILE_FIELD,
	normalizeDownloadStreamError,
} from './download-response.js';
import { nodeBuiltin } from './import.js';
import { extractBoundary } from './multipart.js';
import { MultipartHeaderObserver } from './multipart-header-observer.js';
import { createChunkTap } from './stream-tap.js';

const BUSBOY_IMPORT_ERROR_PREFIX = '"downloadFiles" is not supported: ';
const LOCAL_DOWNLOAD_IMPORT_ERROR_PREFIX =
	'Downloading files to local files is not supported: ';

export type FileStreamHandler = (
	fileStream: Readable,
	totalBytes?: number
) => void;

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function collectErrorPart(
	fileStream: Readable,
	metadata: DownloadMetadata,
	mimeType: string
): Promise<void> {
	const consumers = nodeBuiltin(
		'node:stream/consumers',
		BUSBOY_IMPORT_ERROR_PREFIX
	);
	try {
		const payload = await consumers.arrayBuffer(fileStream);
		assignDownloadErrorPart(metadata, new Uint8Array(payload), mimeType);
	} catch (error) {
		metadata.error = `Stream error: ${errorMessage(error)}`;
	}
}

async function bufferFilePart(
	fileStream: Readable,
	metadata: DownloadMetadata
): Promise<void> {
	const consumers = nodeBuiltin(
		'node:stream/consumers',
		BUSBOY_IMPORT_ERROR_PREFIX
	);
	try {
		metadata.result = await consumers.buffer(fileStream);
	} catch (error) {
		metadata.error = `Read failed: ${errorMessage(error)}`;
	}
}

async function writeFilePart(
	fileStream: Readable,
	metadata: DownloadMetadata,
	destination: string
): Promise<void> {
	const fs = nodeBuiltin('node:fs', LOCAL_DOWNLOAD_IMPORT_ERROR_PREFIX);
	const { pipeline } = nodeBuiltin(
		'node:stream/promises',
		LOCAL_DOWNLOAD_IMPORT_ERROR_PREFIX
	);
	try {
		await pipeline(fileStream, fs.createWriteStream(destination));
		metadata.result = destination;
	} catch (error) {
		metadata.error = `Write stream failed: ${errorMessage(error)}`;
		try {
			await fs.promises.rm(destination, { force: true });
		} catch (removeError) {
			metadata.error = `${metadata.error}; partial file ${destination} was not removed: ${errorMessage(removeError)}`;
		}
	}
}

function routeFilePart(
	fieldName: string,
	fileStream: Readable,
	mimeType: string,
	metadata: DownloadMetadata
): Promise<void> {
	if (fieldName === DOWNLOAD_ERROR_FIELD) {
		return collectErrorPart(fileStream, metadata, mimeType);
	}
	if (fieldName !== DOWNLOAD_FILE_FIELD) {
		fileStream.resume();
		return Promise.resolve();
	}
	return metadata.destination
		? writeFilePart(fileStream, metadata, metadata.destination)
		: bufferFilePart(fileStream, metadata);
}

export async function processDownloadFilesResponseWithBusboy(
	body: ReadableStream<Uint8Array> | null,
	contentType: string,
	metadataMap: Map<string, DownloadMetadata>,
	onFileStream?: FileStreamHandler
): Promise<void> {
	if (!body) {
		throw new SnapflowError('Received a download response without a body');
	}
	const { Readable, Transform } = nodeBuiltin(
		'node:stream',
		BUSBOY_IMPORT_ERROR_PREFIX
	);
	const { pipeline } = nodeBuiltin(
		'node:stream/promises',
		BUSBOY_IMPORT_ERROR_PREFIX
	);
	const boundary = extractBoundary(contentType);
	const observer = boundary ? new MultipartHeaderObserver(boundary) : null;
	const parser = busboy({
		headers: { [CONTENT_TYPE_HEADER]: contentType },
		preservePath: true,
	});
	const fileTasks: Promise<void>[] = [];
	let handedOff = false;

	parser.on('file', (fieldName, fileStream, info) => {
		const totalBytes = observer?.next();
		const { filename } = info;
		if (filename === undefined) {
			parser.destroy(
				new SnapflowError('Received a file part without a filename.')
			);
			return;
		}
		const metadata = metadataMap.get(filename);
		if (!metadata) {
			parser.destroy(
				new SnapflowError(`Received unexpected file "${filename}".`)
			);
			return;
		}
		if (fieldName === DOWNLOAD_FILE_FIELD && onFileStream) {
			handedOff = true;
			onFileStream(fileStream, totalBytes);
			return;
		}
		fileTasks.push(
			routeFilePart(fieldName, fileStream, info.mimeType, metadata)
		);
	});

	const source = Readable.from(body, { objectMode: false });
	try {
		await (observer
			? pipeline(
					source,
					createChunkTap(Transform, (chunk) => observer.observe(chunk)),
					parser
				)
			: pipeline(source, parser));
	} catch (error) {
		if (!handedOff) {
			throw normalizeDownloadStreamError(error);
		}
	} finally {
		await Promise.all(fileTasks);
	}
}
