/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';
import {
	Injectable,
	Logger,
	ServiceUnavailableException,
} from '@nestjs/common';
import { z } from 'zod';
import { errorMessage, errorStack } from '../../common/utils/error/error.util';
import { ObjectStorageProvider } from '../../config/enums/object-storage-provider.enum';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { StorageAccessDto } from '../dto/storage-access.dto';
import { staticCredentials } from '../utils/s3-credentials.util';

const TEMPORARY_CREDENTIAL_LIFETIME_SECONDS = 3600;
const IAM_POLICY_VERSION = '2012-10-17';
const STS_MAXIMUM_ATTEMPTS = 3;
const PUSH_ACCESS_UNAVAILABLE_MESSAGE =
	'Temporary object storage credentials are unavailable';

const temporaryCredentialsSchema = z.object({
	AccessKeyId: z.string().min(1),
	SecretAccessKey: z.string().min(1),
	SessionToken: z.string().min(1),
});

function organizationPushPolicy(bucket: string, organizationId: string) {
	return {
		Version: IAM_POLICY_VERSION,
		Statement: [
			{
				Effect: 'Allow',
				Action: ['s3:PutObject', 's3:GetObject'],
				Resource: [`arn:aws:s3:::${bucket}/${organizationId}/*`],
			},
			{
				Effect: 'Allow',
				Action: ['s3:ListBucket'],
				Resource: [`arn:aws:s3:::${bucket}`],
				Condition: {
					StringLike: {
						's3:prefix': [`${organizationId}`, `${organizationId}/*`],
					},
				},
			},
		],
	};
}

@Injectable()
export class ObjectStoragePushAccessService {
	private readonly logger = new Logger(ObjectStoragePushAccessService.name);

	constructor(private readonly configService: TypedConfigService) {}

	async getPushAccess(organizationId: string): Promise<StorageAccessDto> {
		const endpoint = this.configService.get('s3.endpoint');
		if (!endpoint) {
			throw new ServiceUnavailableException('Object storage is not configured');
		}
		try {
			const bucket = this.configService.getOrThrow('s3.defaultBucket');
			const response = await this.stsClient(endpoint).send(
				new AssumeRoleCommand({
					RoleArn: this.configService.get('s3.roleArn'),
					RoleSessionName: `snapflow-${organizationId}-${Date.now()}`,
					DurationSeconds: TEMPORARY_CREDENTIAL_LIFETIME_SECONDS,
					Policy: JSON.stringify(
						organizationPushPolicy(bucket, organizationId)
					),
				})
			);
			const credentials = temporaryCredentialsSchema.parse(
				response.Credentials
			);
			return {
				accessKey: credentials.AccessKeyId,
				secret: credentials.SecretAccessKey,
				sessionToken: credentials.SessionToken,
				storageUrl: endpoint,
				organizationId,
				bucket,
			};
		} catch (error) {
			this.logger.error(
				`Storage push access error: ${errorMessage(error)}`,
				errorStack(error)
			);
			throw new ServiceUnavailableException(PUSH_ACCESS_UNAVAILABLE_MESSAGE);
		}
	}

	private stsClient(endpoint: string): STSClient {
		const credentials = staticCredentials(
			this.configService.get('s3.accessKey'),
			this.configService.get('s3.secretKey')
		);
		return new STSClient({
			region: this.configService.getOrThrow('s3.region'),
			maxAttempts: STS_MAXIMUM_ATTEMPTS,
			...(this.configService.get('s3.provider') ===
			ObjectStorageProvider.S3_COMPATIBLE
				? { endpoint }
				: {}),
			...(credentials ? { credentials } : {}),
		});
	}
}
