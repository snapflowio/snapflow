/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CommittedEventPublisher } from '../../infra/database/services/committed-event-publisher.service';
import { OrganizationEvents } from '../../organization/constants/organization-events.constants';
import { OrganizationMembershipChangedEvent } from '../../organization/events/organization-membership-changed.event';
import { OrganizationRolesChangedEvent } from '../../organization/events/organization-roles-changed.event';
import { OrganizationService } from '../../organization/services/organization.service';
import { permissionPairs } from '../../organization/utils/organization-permissions.util';
import { API_KEY_CONFIG_ID } from '../constants/api-key.constants';
import { AuthEvents } from '../constants/auth-events.constants';
import { MACHINE_ENROLLMENT_KEY_CREATOR_PERMISSIONS } from '../constants/machine-enrollment-key.constants';
import { ApiKey } from '../entities/api-key.entity';
import { ApiKeyRevokedEvent } from '../events/api-key-revoked.event';
import {
	apiKeyCreator,
	storedApiKeyPermissions,
} from '../utils/api-key-metadata.util';
import { OrganizationAccessService } from './organization-access.service';

type ApiKeyGrant = Pick<ApiKey, 'id' | 'configId' | 'permissions' | 'metadata'>;

function requiredPermissions(
	key: ApiKeyGrant
): Readonly<Record<string, readonly string[]>> {
	return key.configId === API_KEY_CONFIG_ID.MACHINE_ENROLLMENT
		? MACHINE_ENROLLMENT_KEY_CREATOR_PERMISSIONS
		: storedApiKeyPermissions(key.permissions);
}

@Injectable()
export class OrganizationApiKeyRevocationService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly committedEvents: CommittedEventPublisher,
		private readonly organizations: OrganizationService,
		private readonly access: OrganizationAccessService
	) {}

	@OnEvent(OrganizationEvents.MEMBERSHIP_CHANGED)
	async handleMembershipChanged(
		event: OrganizationMembershipChangedEvent
	): Promise<void> {
		const keys = (await this.enabledKeys(event.organizationId)).filter(
			({ metadata }) => apiKeyCreator(metadata) === event.userId
		);
		await this.revokeUnauthorized(event.organizationId, event.userId, keys);
	}

	@OnEvent(OrganizationEvents.ROLES_CHANGED)
	async handleRolesChanged(
		event: OrganizationRolesChangedEvent
	): Promise<void> {
		const keysByCreator = new Map<string | null, ApiKeyGrant[]>();
		for (const key of await this.enabledKeys(event.organizationId)) {
			const creatorId = apiKeyCreator(key.metadata);
			keysByCreator.set(creatorId, [
				...(keysByCreator.get(creatorId) ?? []),
				key,
			]);
		}
		for (const [creatorId, keys] of keysByCreator) {
			if (creatorId) {
				await this.revokeUnauthorized(event.organizationId, creatorId, keys);
			} else {
				await this.disable(keys);
			}
		}
	}

	private enabledKeys(organizationId: string): Promise<ApiKeyGrant[]> {
		return this.entityManager
			.fork()
			.find(
				ApiKey,
				{ referenceId: organizationId, enabled: true },
				{ fields: ['id', 'configId', 'permissions', 'metadata'] }
			);
	}

	private async revokeUnauthorized(
		organizationId: string,
		creatorId: string,
		keys: readonly ApiKeyGrant[]
	): Promise<void> {
		if (keys.length === 0) return;
		const membership = await this.organizations.findMembership(
			organizationId,
			creatorId
		);
		if (!membership) {
			await this.disable(keys);
			return;
		}
		const unauthorized: ApiKeyGrant[] = [];
		for (const key of keys) {
			const requested = permissionPairs(requiredPermissions(key));
			const granted = await this.access.grantedPermissions(
				organizationId,
				membership.role,
				requested
			);
			if (granted.length < requested.length) unauthorized.push(key);
		}
		await this.disable(unauthorized);
	}

	private async disable(keys: readonly ApiKeyGrant[]): Promise<void> {
		if (keys.length === 0) return;
		const keyIds = keys.map(({ id }) => id);
		await this.entityManager.transactional((manager) =>
			manager.nativeUpdate(ApiKey, { id: { $in: keyIds } }, { enabled: false })
		);
		for (const keyId of keyIds) {
			this.committedEvents.publish(
				AuthEvents.API_KEY_REVOKED,
				new ApiKeyRevokedEvent(keyId)
			);
		}
	}
}
