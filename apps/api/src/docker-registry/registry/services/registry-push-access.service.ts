/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { OrganizationService } from '../../../organization/tenant/services/organization.service';
import { registryHost } from '../../persistence/utils/docker-registry-url.util';
import {
	PUSH_ACTIONS,
	REGISTRY_TOKEN,
	RegistrySubjectKind,
} from '../constants/registry-token.constants';
import type { RegistryPushAccessDto } from '../dto/registry-push-access.dto';
import {
	namespaceAccess,
	registryPushNamespace,
	registrySubject,
} from '../utils/registry-token-scope.util';
import { DockerRegistryLookupService } from './docker-registry-lookup.service';
import { RegistryTokenService } from './registry-token.service';

@Injectable()
export class RegistryPushAccessService {
	constructor(
		private readonly registryLookup: DockerRegistryLookupService,
		private readonly organizations: OrganizationService,
		private readonly registryTokens: RegistryTokenService
	) {}

	async getPushAccess(
		organizationId: string,
		userId: string
	): Promise<RegistryPushAccessDto> {
		await this.organizations.assertActive(organizationId);
		const registry = this.registryLookup.getAvailableTransientRegistry();
		const namespace = registryPushNamespace(organizationId);
		const token = await this.registryTokens.issue({
			subject: registrySubject(RegistrySubjectKind.USER, userId),
			access: [namespaceAccess(namespace, PUSH_ACTIONS)],
			ttlSeconds: REGISTRY_TOKEN.PUSH_TTL_SECONDS,
		});

		return {
			username: token.username,
			secret: token.secret,
			registryId: registry.id,
			registryUrl: registryHost(registry.url),
			project: namespace,
			expiresAt: token.expiresAt.toISOString(),
		};
	}
}
