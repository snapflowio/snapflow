/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import {
	DeleteObjectsCommand,
	GetObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
	BadRequestException,
	HttpStatus,
	Injectable,
	ServiceUnavailableException,
} from '@nestjs/common';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { PRESIGNED_URL_LIFETIME_SECONDS } from '../constants/object-storage.constants';
import { staticCredentials } from '../utils/s3-credentials.util';

const maximumBuildContexts = 16;
const buildContextHashPattern = /^[a-f0-9]{64}$/;
const volumeBackupMediaType = 'application/vnd.snapflow.volume-backup';
const immutableObjectContentType = 'application/json';
const buildLogContentType = 'text/plain; charset=utf-8';
const maximumDeleteBatch = 1000;

export interface BuildLogUpload {
	uploadUrl: string;
}

@Injectable()
export class ObjectStorageService {
	constructor(private readonly configService: TypedConfigService) {}

	async putImmutableJson(objectKey: string, body: Uint8Array): Promise<void> {
		const { bucket, client } = this.storage();
		const checksum = createHash('sha256').update(body).digest('base64');
		try {
			await client.send(
				new PutObjectCommand({
					Bucket: bucket,
					Key: objectKey,
					Body: body,
					ContentType: immutableObjectContentType,
					ChecksumSHA256: checksum,
					IfNoneMatch: '*',
				})
			);
		} catch (error) {
			if (!isPreconditionFailure(error)) throw error;
			const existing = await client.send(
				new GetObjectCommand({ Bucket: bucket, Key: objectKey })
			);
			if (!existing.Body) throw new Error('Immutable object has no body');
			const bytes = await existing.Body.transformToByteArray();
			if (
				bytes.byteLength !== body.byteLength ||
				!timingSafeEqual(Buffer.from(bytes), Buffer.from(body))
			) {
				throw new Error(`Immutable object key collision: ${objectKey}`, {
					cause: error,
				});
			}
		}
	}

	async createVolumeBackupUpload(objectKey: string): Promise<string> {
		const { bucket, client } = this.storage();
		return getSignedUrl(
			client,
			new PutObjectCommand({
				Bucket: bucket,
				Key: objectKey,
				ContentType: volumeBackupMediaType,
			}),
			{ expiresIn: PRESIGNED_URL_LIFETIME_SECONDS.VOLUME_BACKUP }
		);
	}

	/** Range is left unsigned so the holder may fetch any byte range. */
	async createVolumeBackupDownload(objectKey: string): Promise<string> {
		const { bucket, client } = this.storage();
		return getSignedUrl(
			client,
			new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
			{ expiresIn: PRESIGNED_URL_LIFETIME_SECONDS.VOLUME_BACKUP }
		);
	}

	async deleteObjects(objectKeys: readonly string[]): Promise<void> {
		const { bucket, client } = this.storage();
		for (
			let start = 0;
			start < objectKeys.length;
			start += maximumDeleteBatch
		) {
			const batch = objectKeys.slice(start, start + maximumDeleteBatch);
			const result = await client.send(
				new DeleteObjectsCommand({
					Bucket: bucket,
					Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
				})
			);
			const failure = result.Errors?.[0];
			if (failure) {
				throw new Error(
					`Failed to delete object ${failure.Key}: ${failure.Code} ${failure.Message}`
				);
			}
		}
	}

	async deletePrefix(prefix: string): Promise<void> {
		const { bucket, client } = this.storage();
		let continuationToken: string | undefined;
		do {
			const page = await client.send(
				new ListObjectsV2Command({
					Bucket: bucket,
					Prefix: prefix,
					ContinuationToken: continuationToken,
				})
			);
			const keys = (page.Contents ?? []).flatMap(({ Key }) =>
				Key ? [Key] : []
			);
			await this.deleteObjects(keys);
			continuationToken = page.IsTruncated
				? page.NextContinuationToken
				: undefined;
		} while (continuationToken);
	}

	async createBuildLogUpload(
		organizationId: string,
		buildReference: string
	): Promise<BuildLogUpload> {
		const { bucket, client } = this.storage();
		const uploadUrl = await getSignedUrl(
			client,
			new PutObjectCommand({
				Bucket: bucket,
				Key: this.buildLogObjectKey(organizationId, buildReference),
				ContentType: buildLogContentType,
			}),
			{ expiresIn: PRESIGNED_URL_LIFETIME_SECONDS.BUILD_LOG }
		);
		return { uploadUrl };
	}

	async createBuildLogDownload(
		organizationId: string,
		buildReference: string
	): Promise<string> {
		const { bucket, client } = this.storage();
		return getSignedUrl(
			client,
			new GetObjectCommand({
				Bucket: bucket,
				Key: this.buildLogObjectKey(organizationId, buildReference),
				ResponseContentType: buildLogContentType,
			}),
			{ expiresIn: PRESIGNED_URL_LIFETIME_SECONDS.BUILD_LOG }
		);
	}

	private buildLogObjectKey(
		organizationId: string,
		buildReference: string
	): string {
		const digest = createHash('sha256').update(buildReference).digest('hex');
		return `${organizationId}/build-logs/${digest}.log`;
	}

	private storage(): { bucket: string; client: S3Client } {
		const endpoint = this.configService.get('s3.endpoint');
		if (!endpoint) {
			throw new ServiceUnavailableException('Object storage is not configured');
		}
		const credentials = staticCredentials(
			this.configService.get('s3.accessKey'),
			this.configService.get('s3.secretKey')
		);
		return {
			bucket: this.configService.getOrThrow('s3.defaultBucket'),
			client: new S3Client({
				endpoint,
				region: this.configService.getOrThrow('s3.region'),
				forcePathStyle: true,
				...(credentials ? { credentials } : {}),
			}),
		};
	}

	async getBuildContextDownloads(
		organizationId: string,
		contextHashes: string[]
	) {
		if (contextHashes.length === 0) {
			return [];
		}
		if (contextHashes.length > maximumBuildContexts) {
			throw new BadRequestException(
				`A build can contain at most ${maximumBuildContexts} context archives`
			);
		}
		const { bucket, client } = this.storage();
		return Promise.all(
			contextHashes.map(async (value) => {
				const hash = value.trim().toLowerCase();
				if (!buildContextHashPattern.test(hash)) {
					throw new BadRequestException(`Invalid build context hash: ${value}`);
				}
				const downloadUrl = await getSignedUrl(
					client,
					new GetObjectCommand({
						Bucket: bucket,
						Key: `${organizationId}/${hash}/context.tar`,
					}),
					{ expiresIn: PRESIGNED_URL_LIFETIME_SECONDS.BUILD_CONTEXT }
				);
				return { hash, downloadUrl };
			})
		);
	}
}

function isPreconditionFailure(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false;
	const candidate = error as {
		name?: unknown;
		$metadata?: { httpStatusCode?: unknown };
	};
	return (
		candidate.name === 'PreconditionFailed' ||
		candidate.$metadata?.httpStatusCode === HttpStatus.PRECONDITION_FAILED
	);
}
