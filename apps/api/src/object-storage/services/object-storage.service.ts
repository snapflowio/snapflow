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
	HeadObjectCommand,
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
import { apiError } from '../../common/utils/error/api-error.util';
import { TypedConfigService } from '../../config/services/typed-config.service';
import {
	BUILD_CONTEXT_HASH_PATTERN,
	buildContextObjectKey,
	MAXIMUM_BUILD_CONTEXTS,
} from '../constants/build-context.constants';
import {
	OBJECT_CONTENT_TYPE,
	PRESIGNED_URL_LIFETIME_SECONDS,
} from '../constants/object-storage.constants';
import { OBJECT_STORAGE_UNAVAILABLE_MESSAGE } from '../constants/object-storage-error.constants';
import { ObjectStorageErrorCode } from '../enums/object-storage-error-code.enum';
import type { ObjectStorageLocation } from '../types/object-storage-location.types';
import { staticCredentials } from '../utils/s3-credentials.util';

const maximumDeleteBatch = 1000;
const IF_NONE_MATCH_ANY = '*';
const S3_ERROR_NAME = {
	NOT_FOUND: 'NotFound',
	PRECONDITION_FAILED: 'PreconditionFailed',
} as const;

export interface StoredObjectPage {
	objects: { key: string; lastModified: Date }[];
	continuationToken?: string;
}

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
					ContentType: OBJECT_CONTENT_TYPE.IMMUTABLE_JSON,
					ChecksumSHA256: checksum,
					IfNoneMatch: IF_NONE_MATCH_ANY,
				})
			);
		} catch (error) {
			if (
				!hasS3Status(
					error,
					HttpStatus.PRECONDITION_FAILED,
					S3_ERROR_NAME.PRECONDITION_FAILED
				)
			) {
				throw error;
			}
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
				ContentType: OBJECT_CONTENT_TYPE.VOLUME_BACKUP,
			}),
			{ expiresIn: PRESIGNED_URL_LIFETIME_SECONDS.VOLUME_BACKUP }
		);
	}

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

	async listObjects(continuationToken?: string): Promise<StoredObjectPage> {
		const { bucket, client } = this.storage();
		const page = await client.send(
			new ListObjectsV2Command({
				Bucket: bucket,
				ContinuationToken: continuationToken,
			})
		);
		return {
			objects: (page.Contents ?? []).flatMap(({ Key, LastModified }) =>
				Key && LastModified ? [{ key: Key, lastModified: LastModified }] : []
			),
			continuationToken: page.IsTruncated
				? page.NextContinuationToken
				: undefined,
		};
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
				ContentType: OBJECT_CONTENT_TYPE.BUILD_LOG,
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
				ResponseContentType: OBJECT_CONTENT_TYPE.BUILD_LOG,
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

	async existingObjects(objectKeys: readonly string[]): Promise<Set<string>> {
		const { bucket, client } = this.storage();
		const found = await Promise.all(
			objectKeys.map(async (key) => {
				try {
					await client.send(
						new HeadObjectCommand({ Bucket: bucket, Key: key })
					);
					return key;
				} catch (error) {
					if (
						hasS3Status(error, HttpStatus.NOT_FOUND, S3_ERROR_NAME.NOT_FOUND)
					) {
						return undefined;
					}
					throw error;
				}
			})
		);
		return new Set(found.filter((key) => key !== undefined));
	}

	location(): ObjectStorageLocation {
		const endpoint = this.configService.get('s3.endpoint');
		if (!endpoint) {
			throw new ServiceUnavailableException(
				apiError(
					ObjectStorageErrorCode.UNAVAILABLE,
					OBJECT_STORAGE_UNAVAILABLE_MESSAGE
				)
			);
		}
		return {
			endpoint,
			region: this.configService.getOrThrow('s3.region'),
			bucket: this.configService.getOrThrow('s3.defaultBucket'),
		};
	}

	private storage(): { bucket: string; client: S3Client } {
		const { endpoint, region, bucket } = this.location();
		const credentials = staticCredentials(
			this.configService.get('s3.accessKey'),
			this.configService.get('s3.secretKey')
		);
		return {
			bucket,
			client: new S3Client({
				endpoint,
				region,
				forcePathStyle: true,
				requestChecksumCalculation: 'WHEN_REQUIRED',
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
		const hashes = normalizeBuildContextHashes(contextHashes);
		const { bucket, client } = this.storage();
		return Promise.all(
			hashes.map(async (hash) => ({
				hash,
				downloadUrl: await getSignedUrl(
					client,
					new GetObjectCommand({
						Bucket: bucket,
						Key: buildContextObjectKey(organizationId, hash),
					}),
					{ expiresIn: PRESIGNED_URL_LIFETIME_SECONDS.BUILD_CONTEXT }
				),
			}))
		);
	}
}

export function normalizeBuildContextHashes(
	contextHashes: readonly string[]
): string[] {
	if (contextHashes.length > MAXIMUM_BUILD_CONTEXTS) {
		throw new BadRequestException(
			apiError(
				ObjectStorageErrorCode.BUILD_CONTEXT_LIMIT_EXCEEDED,
				`A build can contain at most ${MAXIMUM_BUILD_CONTEXTS} context archives. Combine the build contexts and try again.`
			)
		);
	}
	return contextHashes.map((value) => {
		const hash = value.trim().toLowerCase();
		if (!BUILD_CONTEXT_HASH_PATTERN.test(hash)) {
			throw new BadRequestException(
				apiError(
					ObjectStorageErrorCode.BUILD_CONTEXT_HASH_INVALID,
					`Build context hash ${value} is not a valid SHA-256 hex digest. Upload the context again and use the returned hash.`
				)
			);
		}
		return hash;
	});
}

function hasS3Status(error: unknown, status: number, name: string): boolean {
	if (!error || typeof error !== 'object') return false;
	const candidate = error as {
		name?: unknown;
		$metadata?: { httpStatusCode?: unknown };
	};
	return (
		candidate.name === name || candidate.$metadata?.httpStatusCode === status
	);
}
