/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { MILLISECONDS_PER_SECOND } from '../../../common/constants/time.constants';
import type { DockerRegistry } from '../../persistence/entities/docker-registry.entity';
import { REGISTRY_TOKEN } from '../constants/registry-token.constants';
import {
	mergeRegistryAccess,
	type RegistryGrant,
} from '../utils/registry-token-scope.util';
import { RegistryTokenSigner } from './registry-token-signer.service';
import { SnapshotManagerRegistryService } from './snapshot-manager-registry.service';

export type RegistryToken = Readonly<{
	username: string;
	secret: string;
	expiresAt: Date;
}>;

/**
 * Issues short-lived registry tokens that name exactly the repositories a
 * caller may touch. Platform registry passwords never leave the api.
 */
@Injectable()
export class RegistryTokenService {
	constructor(
		private readonly signer: RegistryTokenSigner,
		private readonly snapshotManager: SnapshotManagerRegistryService
	) {}

	async issue(grant: RegistryGrant): Promise<RegistryToken> {
		const issuedAt = Math.floor(Date.now() / MILLISECONDS_PER_SECOND);
		const expiresAt = issuedAt + grant.ttlSeconds;
		const secret = await this.signer.sign({
			iss: REGISTRY_TOKEN.ISSUER,
			aud: REGISTRY_TOKEN.AUDIENCE,
			sub: grant.subject,
			iat: issuedAt,
			nbf: issuedAt,
			exp: expiresAt,
			jti: randomUUID(),
			access: mergeRegistryAccess(grant.access).map((entry) => ({
				type: REGISTRY_TOKEN.RESOURCE_TYPE,
				name: entry.name,
				actions: entry.actions,
			})),
		});
		return {
			username: REGISTRY_TOKEN.USERNAME,
			secret,
			expiresAt: new Date(expiresAt * MILLISECONDS_PER_SECOND),
		};
	}

	/**
	 * Returns the registry with a scoped token in place of its credentials when
	 * it is a platform registry; any other registry keeps its own credentials.
	 */
	async authorize(
		registry: DockerRegistry,
		grant: RegistryGrant
	): Promise<DockerRegistry> {
		if (!this.snapshotManager.manages(registry)) return registry;
		const token = await this.issue(grant);
		return { ...registry, username: token.username, password: token.secret };
	}

	async authorizeOptional(
		registry: DockerRegistry | undefined,
		grant: RegistryGrant
	): Promise<DockerRegistry | undefined> {
		return registry ? this.authorize(registry, grant) : undefined;
	}
}
