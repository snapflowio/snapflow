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

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import {
	type BuildContextUploadsDto,
	createBuildContextUploads,
} from '@snapflow/api-client';
import type { Client } from '@snapflow/api-client/client';
import * as pathe from 'pathe';
import * as tar from 'tar';
import {
	SnapflowError,
	SnapflowNotFoundError,
} from './errors/snapflow-error.js';
import type { Context } from './image.types.js';

const BUILD_CONTEXT_ARCHIVE_NAME = 'context.tar';
const BUILD_CONTEXT_TEMPORARY_PREFIX = 'snapflow-context-';
const HASH_READ_BUFFER_BYTES = 8192;

interface BuildContextArchive {
	path: string;
	sha256: string;
	remove: () => Promise<void>;
}

export async function uploadBuildContexts(
	client: Client,
	contexts: readonly Context[]
): Promise<string[]> {
	const archives: BuildContextArchive[] = [];
	try {
		for (const context of contexts) {
			archives.push(
				await createTarArchive(context.sourcePath, context.archivePath)
			);
		}
		const hashes = [...new Set(archives.map(({ sha256 }) => sha256))];
		const { data } = await createBuildContextUploads({
			client,
			body: { hashes },
		});
		await uploadMissingArchives(data, archives);
		return archives.map(({ sha256 }) => sha256);
	} finally {
		await Promise.all(archives.map((archive) => archive.remove()));
	}
}

async function uploadMissingArchives(
	target: BuildContextUploadsDto,
	archives: readonly BuildContextArchive[]
): Promise<void> {
	const missing = target.uploads.filter((upload) => !upload.exists);
	if (missing.length === 0) return;
	if (!target.credential) {
		throw new SnapflowError(
			'The build context upload response has no credential for the missing archives'
		);
	}
	const storage = new S3Client({
		endpoint: target.endpoint,
		region: target.region,
		forcePathStyle: true,
		requestChecksumCalculation: 'WHEN_REQUIRED',
		credentials: {
			accessKeyId: target.credential.accessKeyId,
			secretAccessKey: target.credential.secretAccessKey,
			sessionToken: target.credential.sessionToken,
		},
	});
	const archivePaths = new Map(
		archives.map(({ sha256, path }) => [sha256, path])
	);
	for (const upload of missing) {
		const archivePath = archivePaths.get(upload.hash);
		if (!archivePath) {
			throw new SnapflowError(
				`No local build context archive matches hash ${upload.hash}`
			);
		}
		await new Upload({
			client: storage,
			params: {
				Bucket: target.bucket,
				Key: upload.key,
				Body: fs.createReadStream(archivePath),
			},
		}).done();
	}
}

async function createTarArchive(
	sourcePath: string,
	archiveBasePath: string
): Promise<BuildContextArchive> {
	if (!fs.existsSync(sourcePath)) {
		throw new SnapflowNotFoundError(`Path does not exist: ${sourcePath}`);
	}
	const temporaryDirectory = await fs.promises.mkdtemp(
		pathe.join(os.tmpdir(), BUILD_CONTEXT_TEMPORARY_PREFIX)
	);
	const remove = () =>
		fs.promises.rm(temporaryDirectory, { recursive: true, force: true });
	const archivePath = pathe.join(
		temporaryDirectory,
		BUILD_CONTEXT_ARCHIVE_NAME
	);
	try {
		const normalizedSourcePath = pathe.normalize(pathe.resolve(sourcePath));
		const normalizedArchiveBasePath = pathe.normalize(archiveBasePath);
		const basePrefix =
			normalizedArchiveBasePath === '.'
				? normalizedSourcePath
				: normalizedSourcePath.slice(
						0,
						normalizedSourcePath.length - normalizedArchiveBasePath.length
					);
		await tar.create(
			{
				cwd: basePrefix,
				file: archivePath,
				portable: true,
				noMtime: true,
				gzip: false,
			},
			[normalizedArchiveBasePath]
		);
		return { path: archivePath, sha256: await hashFile(archivePath), remove };
	} catch (error) {
		await remove();
		throw error;
	}
}

async function hashFile(filePath: string): Promise<string> {
	const hasher = crypto.createHash('sha256');
	for await (const chunk of fs.createReadStream(filePath, {
		highWaterMark: HASH_READ_BUFFER_BYTES,
	})) {
		hasher.update(chunk);
	}
	return hasher.digest('hex');
}
