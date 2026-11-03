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
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import * as pathe from 'pathe';
import * as tar from 'tar';
import { SnapflowNotFoundError } from './errors/snapflow-error.js';

const BUILD_CONTEXT_ARCHIVE_NAME = 'context.tar';
const BUILD_CONTEXT_TEMPORARY_PREFIX = 'snapflow-context-';
const HASH_READ_BUFFER_BYTES = 8192;
const DEFAULT_BUCKET_NAME = 'snapflow-volume-builds';
const DEFAULT_AWS_REGION = 'us-east-1';

export interface ObjectStorageConfig {
	endpointUrl: string;
	accessKeyId: string;
	secretAccessKey: string;
	sessionToken?: string;
	bucketName?: string;
}

export class ObjectStorage {
	private bucketName: string;
	private s3Client: S3Client;

	constructor(config: ObjectStorageConfig) {
		this.bucketName = config.bucketName || DEFAULT_BUCKET_NAME;
		this.s3Client = new S3Client({
			region: this.extractAwsRegion(config.endpointUrl) || DEFAULT_AWS_REGION,
			endpoint: config.endpointUrl,
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey,
				sessionToken: config.sessionToken,
			},
			forcePathStyle: true,
		});
	}

	async upload(
		path: string,
		organizationId: string,
		archiveBasePath: string
	): Promise<string> {
		if (!fs.existsSync(path)) {
			const errMsg = `Path does not exist: ${path}`;
			throw new SnapflowNotFoundError(errMsg);
		}

		const archive = await this.createTarArchive(path, archiveBasePath);
		try {
			const prefix = `${organizationId}/${archive.sha256}/`;
			if (!(await this.folderExistsInS3(prefix))) {
				await this.uploadArchive(
					`${prefix}${BUILD_CONTEXT_ARCHIVE_NAME}`,
					archive.path
				);
			}
			return archive.sha256;
		} finally {
			await archive.remove();
		}
	}

	private async createTarArchive(sourcePath: string, archiveBasePath: string) {
		const temporaryDirectory = await fs.promises.mkdtemp(
			pathe.join(os.tmpdir(), BUILD_CONTEXT_TEMPORARY_PREFIX)
		);
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
			const hasher = crypto.createHash('sha256');
			await this.hashFile(archivePath, hasher);
			return {
				path: archivePath,
				sha256: hasher.digest('hex'),
				remove: () =>
					fs.promises.rm(temporaryDirectory, { recursive: true, force: true }),
			};
		} catch (error) {
			await fs.promises.rm(temporaryDirectory, {
				recursive: true,
				force: true,
			});
			throw error;
		}
	}

	private async hashFile(filePath: string, hasher: crypto.Hash): Promise<void> {
		for await (const chunk of fs.createReadStream(filePath, {
			highWaterMark: HASH_READ_BUFFER_BYTES,
		})) {
			hasher.update(chunk);
		}
	}

	private async folderExistsInS3(prefix: string): Promise<boolean> {
		const response = await this.s3Client.send(
			new ListObjectsV2Command({
				Bucket: this.bucketName,
				Prefix: prefix,
				MaxKeys: 1,
			})
		);

		return !!response.Contents && response.Contents.length > 0;
	}

	private async uploadArchive(s3Key: string, archivePath: string) {
		const uploader = new Upload({
			client: this.s3Client,
			params: {
				Bucket: this.bucketName,
				Key: s3Key,
				Body: fs.createReadStream(archivePath),
			},
		});

		await uploader.done();
	}

	private extractAwsRegion(endpoint: string): string | undefined {
		const match = endpoint.match(/s3[.-]([a-z0-9-]+)\.amazonaws\.com/);
		return match?.[1];
	}
}
