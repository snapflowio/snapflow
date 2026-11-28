/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';
import {
	Injectable,
	Logger,
	ServiceUnavailableException,
} from '@nestjs/common';
import { z } from 'zod';
import { apiError } from '../../common/utils/error/api-error.util';
import { errorMessage, errorStack } from '../../common/utils/error/error.util';
import { ObjectStorageProvider } from '../../config/enums/object-storage-provider.enum';
import { TypedConfigService } from '../../config/services/typed-config.service';
import {
	STS_MAXIMUM_ATTEMPTS,
	STS_SESSION_NAME_PREFIX,
	UPLOAD_CREDENTIAL_UNAVAILABLE_MESSAGE,
} from '../constants/object-storage-credential.constants';
import { ObjectStorageErrorCode } from '../enums/object-storage-error-code.enum';
import type {
	ObjectStorageCredential,
	ObjectUploadGrant,
} from '../types/object-storage-credential.types';
import type { ObjectStorageLocation } from '../types/object-storage-location.types';
import { iamUploadPolicy } from '../utils/iam-upload-policy.util';
import { signR2UploadCredential } from '../utils/r2-temporary-credential.util';
import { staticCredentials } from '../utils/s3-credentials.util';
import { ObjectStorageService } from './object-storage.service';

const assumedRoleCredentialsSchema = z.object({
	AccessKeyId: z.string().min(1),
	SecretAccessKey: z.string().min(1),
	SessionToken: z.string().min(1),
	Expiration: z.date(),
});

@Injectable()
export class ObjectStorageCredentialService {
	private readonly logger = new Logger(ObjectStorageCredentialService.name);

	constructor(
		private readonly configService: TypedConfigService,
		private readonly objectStorage: ObjectStorageService
	) {}

	async issueUpload(
		grant: ObjectUploadGrant
	): Promise<ObjectStorageCredential> {
		const location = this.objectStorage.location();
		try {
			return await this.issue(location, grant);
		} catch (error) {
			this.logger.error(
				`Upload credential error: ${errorMessage(error)}`,
				errorStack(error)
			);
			throw new ServiceUnavailableException(
				apiError(
					ObjectStorageErrorCode.UNAVAILABLE,
					UPLOAD_CREDENTIAL_UNAVAILABLE_MESSAGE
				)
			);
		}
	}

	private async issue(
		location: ObjectStorageLocation,
		grant: ObjectUploadGrant
	): Promise<ObjectStorageCredential> {
		const accountId = this.configService.get('s3.r2AccountId');
		if (!accountId) return this.assumeRole(location, grant);
		const parent = this.parentCredential();
		if (!parent) throw new Error('R2 upload credentials need S3 access keys');
		return signR2UploadCredential(
			{
				accountId,
				endpoint: location.endpoint,
				bucket: location.bucket,
				parent,
			},
			grant,
			new Date()
		);
	}

	private async assumeRole(
		location: ObjectStorageLocation,
		grant: ObjectUploadGrant
	): Promise<ObjectStorageCredential> {
		const parent = this.parentCredential();
		const client = new STSClient({
			region: location.region,
			maxAttempts: STS_MAXIMUM_ATTEMPTS,
			...(this.configService.get('s3.provider') ===
			ObjectStorageProvider.S3_COMPATIBLE
				? { endpoint: location.endpoint }
				: {}),
			...(parent ? { credentials: parent } : {}),
		});
		const response = await client.send(
			new AssumeRoleCommand({
				RoleArn: this.configService.get('s3.roleArn'),
				RoleSessionName: `${STS_SESSION_NAME_PREFIX}-${randomUUID()}`,
				DurationSeconds: grant.ttlSeconds,
				Policy: iamUploadPolicy(location.bucket, grant.keys),
			})
		);
		const credentials = assumedRoleCredentialsSchema.parse(
			response.Credentials
		);
		return {
			accessKeyId: credentials.AccessKeyId,
			secretAccessKey: credentials.SecretAccessKey,
			sessionToken: credentials.SessionToken,
			expiresAt: credentials.Expiration,
		};
	}

	private parentCredential() {
		return staticCredentials(
			this.configService.get('s3.accessKey'),
			this.configService.get('s3.secretKey')
		);
	}
}
