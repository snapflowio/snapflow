/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ECRClient, GetAuthorizationTokenCommand } from '@aws-sdk/client-ecr';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers';
import {
	BadRequestException,
	Injectable,
	Logger,
	ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { z } from 'zod';
import { MILLISECONDS_PER_SECOND } from '../../../common/constants/time.constants';
import { errorMessage } from '../../../common/utils/error/error.util';
import { millisecondsBetween } from '../../../common/utils/time.util';
import type { DockerRegistry } from '../../persistence/entities/docker-registry.entity';
import {
	ECR_CREDENTIALS,
	ECR_REGISTRY_ROLE_FORBIDDEN,
} from '../constants/ecr-credentials.constants';
import {
	decodeEcrAuthorizationToken,
	type EcrAuth,
	type EcrRole,
	ecrRoleOf,
	ecrSessionName,
	ecrTokenCacheKey,
} from '../utils/ecr-role.util';

const cachedEcrEntrySchema = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal('token'),
		username: z.string(),
		password: z.string(),
	}),
	z.object({ kind: z.literal('failure'), message: z.string() }),
]);
type CachedEcrEntry = z.infer<typeof cachedEcrEntrySchema>;

@Injectable()
export class EcrCredentialsService {
	private readonly logger = new Logger(EcrCredentialsService.name);
	private readonly sts = new STSClient({});
	private platformAccountId: Promise<string> | null = null;

	constructor(@InjectRedis() private readonly redis: Redis) {}

	async assertCustomerRole(
		registry: Pick<DockerRegistry, 'url' | 'username'>
	): Promise<void> {
		const role = ecrRoleOf(registry);
		if (role) {
			await this.assertForeignAccount(role);
		}
	}

	async resolveRegistryCredentials(
		registry: DockerRegistry
	): Promise<DockerRegistry> {
		const role = ecrRoleOf(registry);
		if (!role || !registry.organizationId) {
			return registry;
		}
		await this.assertForeignAccount(role);
		const auth = await this.organizationToken(registry.organizationId, role);
		return { ...registry, ...auth };
	}

	private async assertForeignAccount(role: EcrRole): Promise<void> {
		if (role.accountId === (await this.platformAccount())) {
			throw new BadRequestException({
				code: ECR_REGISTRY_ROLE_FORBIDDEN,
				message:
					'The registry role must belong to your own AWS account, not to Snapflow',
			});
		}
	}

	private async organizationToken(
		organizationId: string,
		role: EcrRole
	): Promise<EcrAuth> {
		const cacheKey = ecrTokenCacheKey(organizationId, role);
		const cached = await this.redis.get(cacheKey);
		if (cached) {
			const entry = cachedEcrEntrySchema.parse(JSON.parse(cached));
			if (entry.kind === 'failure') {
				throw new Error(`(cached) ${entry.message}`);
			}
			return { username: entry.username, password: entry.password };
		}
		try {
			const auth = await this.assumeRoleToken(organizationId, role, cacheKey);
			this.logger.log(
				`Resolved ECR credentials for region=${role.region} role=${role.roleArn}`
			);
			return auth;
		} catch (error) {
			await this.cacheEntry(
				cacheKey,
				{ kind: 'failure', message: errorMessage(error) },
				ECR_CREDENTIALS.FAILURE_CACHE_SECONDS
			).catch((cacheError: unknown) =>
				this.logger.warn(
					`Failed to cache ECR credential failure: ${errorMessage(cacheError)}`
				)
			);
			throw error;
		}
	}

	private async assumeRoleToken(
		organizationId: string,
		role: EcrRole,
		cacheKey: string
	): Promise<EcrAuth> {
		const ecr = new ECRClient({
			region: role.region,
			credentials: fromTemporaryCredentials({
				params: {
					RoleArn: role.roleArn,
					RoleSessionName: ecrSessionName(organizationId),
					ExternalId: organizationId,
				},
			}),
		});
		const response = await ecr.send(new GetAuthorizationTokenCommand({}));
		const data = response.authorizationData?.[0];
		if (!data?.authorizationToken) {
			throw new Error('ECR returned no authorization data');
		}
		const auth = decodeEcrAuthorizationToken(data.authorizationToken);
		if (data.expiresAt) {
			const ttlSeconds =
				Math.floor(
					millisecondsBetween(new Date(), data.expiresAt) /
						MILLISECONDS_PER_SECOND
				) - ECR_CREDENTIALS.REFRESH_BUFFER_SECONDS;
			if (ttlSeconds > 0) {
				await this.cacheEntry(cacheKey, { kind: 'token', ...auth }, ttlSeconds);
			}
		}
		return auth;
	}

	private async cacheEntry(
		cacheKey: string,
		entry: CachedEcrEntry,
		ttlSeconds: number
	): Promise<void> {
		await this.redis.setex(cacheKey, ttlSeconds, JSON.stringify(entry));
	}

	private platformAccount(): Promise<string> {
		this.platformAccountId ??= this.lookupPlatformAccount();
		return this.platformAccountId;
	}

	private async lookupPlatformAccount(): Promise<string> {
		try {
			const { Account } = await this.sts.send(new GetCallerIdentityCommand({}));
			if (!Account) {
				throw new Error('AWS STS returned no account');
			}
			return Account;
		} catch (error) {
			this.platformAccountId = null;
			this.logger.error(
				`Cannot resolve the platform AWS account: ${errorMessage(error)}`
			);
			throw new ServiceUnavailableException(
				'ECR registry roles cannot be verified right now'
			);
		}
	}
}
