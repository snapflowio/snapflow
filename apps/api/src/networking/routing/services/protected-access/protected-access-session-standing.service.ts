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
import { parseOrganizationRoles } from '@snapflow/organization-access';
import { ApiKey } from '../../../../auth/entities/api-key.entity';
import { OrganizationAccessService } from '../../../../auth/services/organization-access.service';
import { storedApiKeyPermissions } from '../../../../auth/utils/api-key-metadata.util';
import { AUTH_CREDENTIAL_TYPES } from '../../../../common/types/organization-auth-context.types';
import { Member } from '../../../../organization/tenant/entities/member.entity';
import { Organization } from '../../../../organization/tenant/entities/organization.entity';
import { toCredentialPermissions } from '../../../../organization/tenant/utils/organization-permissions.util';
import { isSuspensionActive } from '../../../../organization/tenant/utils/organization-suspension.util';
import { User } from '../../../../user/entities/user.entity';
import { isBanActive } from '../../../../user/utils/user-ban.util';
import {
	EXPOSURE_BACKEND_STATE,
	EXPOSURE_DESIRED_STATE,
} from '../../constants/exposure.constants';
import { Exposure } from '../../entities/exposure.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import {
	accessCredentialKey,
	findLiveAccessCredentials,
} from '../../queries/live-access-credential.query';
import {
	SANDBOX_WRITE_PERMISSION,
	systemExposureRequiresSandboxWrite,
} from '../../utils/exposure/system-exposure-access-policy.util';
import type { StoredAccessSession } from '../../utils/protected-access-session.util';

interface SessionStandingFacts {
	exposures: Map<
		string,
		Pick<Exposure, 'generation' | 'desiredState' | 'deletionRequestedAt'>
	>;
	activeBackendIds: Set<string>;
	activeUserIds: Set<string>;
	activeOrganizationIds: Set<string>;
	membershipKeys: Set<string>;
	liveCredentialKeys: Set<string>;
	sandboxWriterSessionIds: Set<string>;
}

@Injectable()
export class ProtectedAccessSessionStandingService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly organizationAccess: OrganizationAccessService
	) {}

	async findRevoked(
		sessions: readonly StoredAccessSession[],
		observedAt: Date
	): Promise<Set<string>> {
		if (sessions.length === 0) return new Set();
		const facts = await this.loadFacts(sessions, observedAt);
		return new Set(
			sessions
				.filter((session) => !this.inGoodStanding(session, facts))
				.map((session) => session.sessionId)
		);
	}

	private inGoodStanding(
		session: StoredAccessSession,
		facts: SessionStandingFacts
	): boolean {
		const exposure = facts.exposures.get(session.exposureId);
		return (
			exposure?.generation === session.exposureGeneration &&
			exposure.desiredState === EXPOSURE_DESIRED_STATE.ACTIVE &&
			!exposure.deletionRequestedAt &&
			facts.activeBackendIds.has(session.backendId) &&
			facts.activeUserIds.has(session.userId) &&
			facts.activeOrganizationIds.has(session.organizationId) &&
			facts.membershipKeys.has(membershipKey(session)) &&
			facts.liveCredentialKeys.has(accessCredentialKey(session.credential)) &&
			(!systemExposureRequiresSandboxWrite(session.systemService) ||
				facts.sandboxWriterSessionIds.has(session.sessionId))
		);
	}

	private async loadFacts(
		sessions: readonly StoredAccessSession[],
		observedAt: Date
	): Promise<SessionStandingFacts> {
		const manager = this.entityManager.fork();
		const unique = (values: string[]) => [...new Set(values)];
		const userIds = unique(sessions.map((s) => s.userId));
		const organizationIds = unique(sessions.map((s) => s.organizationId));
		const [
			exposures,
			backends,
			users,
			organizations,
			members,
			liveCredentialKeys,
		] = await Promise.all([
			manager.find(
				Exposure,
				{ id: { $in: unique(sessions.map((s) => s.exposureId)) } },
				{
					fields: ['id', 'generation', 'desiredState', 'deletionRequestedAt'],
				}
			),
			manager.find(
				ExposureBackend,
				{
					id: { $in: unique(sessions.map((s) => s.backendId)) },
					state: EXPOSURE_BACKEND_STATE.ACTIVE,
					leaseExpiresAt: { $gt: observedAt },
				},
				{ fields: ['id'] }
			),
			manager.find(
				User,
				{ id: { $in: userIds } },
				{ fields: ['id', 'banned', 'banExpires'] }
			),
			manager.find(
				Organization,
				{ id: { $in: organizationIds }, deletedAt: null },
				{ fields: ['id', 'suspended', 'suspendedUntil'] }
			),
			manager.find(
				Member,
				{
					organizationId: { $in: organizationIds },
					userId: { $in: userIds },
				},
				{ fields: ['organizationId', 'userId', 'role'] }
			),
			findLiveAccessCredentials(
				manager,
				sessions.map(({ credential }) => credential),
				observedAt
			),
		]);
		return {
			exposures: new Map(exposures.map((exposure) => [exposure.id, exposure])),
			activeBackendIds: new Set(backends.map((backend) => backend.id)),
			activeUserIds: new Set(
				users
					.filter((user) => !isBanActive(user, observedAt))
					.map((user) => user.id)
			),
			activeOrganizationIds: new Set(
				organizations
					.filter(
						(organization) => !isSuspensionActive(organization, observedAt)
					)
					.map((organization) => organization.id)
			),
			membershipKeys: new Set(members.map(membershipKey)),
			liveCredentialKeys,
			sandboxWriterSessionIds: await this.sandboxWriterSessionIds(
				manager,
				sessions,
				members
			),
		};
	}

	// Toolbox, terminal, desktop and SSH grants require sandbox write
	// permission; re-checking it on every heartbeat ends the session of a member
	// or key that lost it instead of letting it run to its absolute expiry.
	private async sandboxWriterSessionIds(
		manager: EntityManager,
		sessions: readonly StoredAccessSession[],
		members: readonly Pick<Member, 'organizationId' | 'userId' | 'role'>[]
	): Promise<Set<string>> {
		const writerSessions = sessions.filter((session) =>
			systemExposureRequiresSandboxWrite(session.systemService)
		);
		if (writerSessions.length === 0) return new Set();
		const roles = new Map(
			members.map((member) => [membershipKey(member), member.role])
		);
		const apiKeyIds = [
			...new Set(
				writerSessions
					.filter(
						({ credential }) =>
							credential.type === AUTH_CREDENTIAL_TYPES.API_KEY
					)
					.map(({ credential }) => credential.id)
			),
		];
		const apiKeys =
			apiKeyIds.length === 0
				? []
				: await manager.find(
						ApiKey,
						{ id: { $in: apiKeyIds } },
						{ fields: ['id', 'permissions'] }
					);
		const keyPermissions = new Map(
			apiKeys.map((key) => [
				key.id,
				toCredentialPermissions(storedApiKeyPermissions(key.permissions)),
			])
		);
		const decisions = await Promise.all(
			writerSessions.map(async (session) => {
				const role = roles.get(membershipKey(session));
				const isApiKey =
					session.credential.type === AUTH_CREDENTIAL_TYPES.API_KEY;
				const permissions = isApiKey
					? keyPermissions.get(session.credential.id)
					: null;
				if (role === undefined || permissions === undefined) return null;
				const granted = await this.organizationAccess.grantedToMember(
					session.organizationId,
					parseOrganizationRoles(role),
					permissions,
					[SANDBOX_WRITE_PERMISSION]
				);
				return granted.length > 0 ? session.sessionId : null;
			})
		);
		return new Set(
			decisions.filter((sessionId): sessionId is string => sessionId !== null)
		);
	}
}

function membershipKey({
	organizationId,
	userId,
}: Pick<Member, 'organizationId' | 'userId'>): string {
	return `${organizationId}:${userId}`;
}
