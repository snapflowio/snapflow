/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EntityManager } from '@mikro-orm/postgresql';
import { ApiKey } from '../../../../auth/entities/api-key.entity';
import { Session } from '../../../../auth/entities/session.entity';
import { OrganizationAccessService } from '../../../../auth/services/organization-access.service';
import { MILLISECONDS_PER_SECOND } from '../../../../common/constants/time.constants';
import { fakeInstance } from '../../../../common/testing/instance.fake';
import { AUTH_CREDENTIAL_TYPES } from '../../../../common/types/organization-auth-context.types';
import { Member } from '../../../../organization/tenant/entities/member.entity';
import { Organization } from '../../../../organization/tenant/entities/organization.entity';
import { User } from '../../../../user/entities/user.entity';
import {
	EXPOSURE_DESIRED_STATE,
	SYSTEM_EXPOSURE_SERVICE,
} from '../../constants/exposure.constants';
import { PROTECTED_ACCESS } from '../../constants/protected-access.constants';
import { Exposure } from '../../entities/exposure.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import {
	type AccessCredential,
	STORED_ACCESS_RECORD,
	type StoredAccessSession,
} from '../../utils/protected-access-session.util';
import { ProtectedAccessSessionStandingService } from './protected-access-session-standing.service';

const NOW = new Date('2026-10-04T12:00:00.000Z');
const USER_ID = '7f9c2a4e-5b1d-4c3a-9e8f-1a2b3c4d5e6f';
const ORGANIZATION_ID = '8e0d3b5f-6c2e-4d4b-8f9a-2b3c4d5e6f70';
const EXPOSURE_ID = '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d';
const BACKEND_ID = '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d6e';
const EXPOSURE_GENERATION = 1;
const IDLE_LIFETIME_SECONDS = 300;
const MEMBER_ROLE = 'member';
const KEY_PERMISSIONS = JSON.stringify({ sandboxes: ['write'] });
const CREDENTIAL_IDS = {
	liveApiKey: '60718293-a4b5-4c6d-9e7f-8091a2b3c4d5',
	deletedApiKey: '718293a4-b5c6-4d7e-8f80-91a2b3c4d5e6',
	liveSession: '8293a4b5-c6d7-4e8f-9091-a2b3c4d5e6f7',
	endedSession: '93a4b5c6-d7e8-4f90-81a2-b3c4d5e6f708',
} as const;

function credentialOf(id: string): AccessCredential {
	switch (id) {
		case CREDENTIAL_IDS.liveApiKey:
		case CREDENTIAL_IDS.deletedApiKey:
			return { type: AUTH_CREDENTIAL_TYPES.API_KEY, id };
		default:
			return { type: AUTH_CREDENTIAL_TYPES.SESSION, id };
	}
}

function storedSession(
	credentialId: string,
	systemService: StoredAccessSession['systemService'] = null
): StoredAccessSession {
	return {
		version: STORED_ACCESS_RECORD.version,
		credential: credentialOf(credentialId),
		sessionId: credentialId,
		edgeId: '3d4e5f60-7182-4c9d-8e1f-2a3b4c5d6e7f',
		backendId: BACKEND_ID,
		sandboxId: 'sandbox-1',
		exposureId: EXPOSURE_ID,
		exposureGeneration: EXPOSURE_GENERATION,
		systemService,
		interactive: false,
		organizationId: ORGANIZATION_ID,
		userId: USER_ID,
		idleLifetimeSeconds: IDLE_LIFETIME_SECONDS,
		absoluteExpiresAt: new Date(
			NOW.getTime() +
				PROTECTED_ACCESS.absoluteSessionLifetimeSeconds *
					MILLISECONDS_PER_SECOND
		).toISOString(),
		expiresAt: NOW.toISOString(),
	};
}

interface Standing {
	banned: boolean;
	suspended: boolean;
	member: boolean;
	roleCanWrite: boolean;
	keyCanWrite: boolean;
}

const GOOD_STANDING: Standing = {
	banned: false,
	suspended: false,
	member: true,
	roleCanWrite: true,
	keyCanWrite: true,
};

function standingManager(
	liveCredentialIds: readonly string[],
	{ banned, suspended, member, keyCanWrite }: Standing = GOOD_STANDING
): EntityManager {
	const live = (ids: readonly string[]) =>
		ids.filter((id) => liveCredentialIds.includes(id)).map((id) => ({ id }));
	const rows = new Map<unknown, unknown[]>([
		[
			Exposure,
			[
				{
					id: EXPOSURE_ID,
					generation: EXPOSURE_GENERATION,
					desiredState: EXPOSURE_DESIRED_STATE.ACTIVE,
					deletionRequestedAt: null,
				},
			],
		],
		[ExposureBackend, [{ id: BACKEND_ID }]],
		[User, [{ id: USER_ID, banned, banExpires: null }]],
		[Organization, [{ id: ORGANIZATION_ID, suspended, suspendedUntil: null }]],
		[
			Member,
			member
				? [
						{
							organizationId: ORGANIZATION_ID,
							userId: USER_ID,
							role: MEMBER_ROLE,
						},
					]
				: [],
		],
	]);
	const finder = fakeInstance(EntityManager, {
		find: async (entity: unknown, where: { id?: { $in: string[] } }) => {
			const credentialEntities: unknown[] = [ApiKey, Session];
			if (credentialEntities.includes(entity)) {
				return live(where.id?.$in ?? []).map(({ id }) => ({
					id,
					permissions: keyCanWrite ? KEY_PERMISSIONS : null,
				}));
			}
			return rows.get(entity) ?? [];
		},
	});
	return fakeInstance(EntityManager, { fork: () => finder });
}

function organizationAccess({
	roleCanWrite,
}: Standing = GOOD_STANDING): OrganizationAccessService {
	return fakeInstance(OrganizationAccessService, {
		grantedToMember: async (
			organizationId: string,
			memberRoles: readonly string[],
			credentialPermissions: { sandboxes?: string[] } | null,
			requested: readonly unknown[]
		) =>
			roleCanWrite &&
			organizationId === ORGANIZATION_ID &&
			memberRoles.includes(MEMBER_ROLE) &&
			(credentialPermissions === null ||
				credentialPermissions.sandboxes?.includes('write'))
				? requested
				: [],
	});
}

describe('ProtectedAccessSessionStandingService.findRevoked', () => {
	it('revokes the sessions whose credential was deleted or ended', async () => {
		const service = new ProtectedAccessSessionStandingService(
			standingManager([CREDENTIAL_IDS.liveApiKey, CREDENTIAL_IDS.liveSession]),
			organizationAccess()
		);

		const revoked = await service.findRevoked(
			Object.values(CREDENTIAL_IDS).map((id) => storedSession(id)),
			NOW
		);

		assert.deepEqual(
			revoked,
			new Set([CREDENTIAL_IDS.deletedApiKey, CREDENTIAL_IDS.endedSession])
		);
	});

	for (const [description, standing] of [
		['a banned user', { ...GOOD_STANDING, banned: true }],
		['a suspended organization', { ...GOOD_STANDING, suspended: true }],
		['a user who left the organization', { ...GOOD_STANDING, member: false }],
	] as const) {
		it(`revokes every session of ${description}`, async () => {
			const service = new ProtectedAccessSessionStandingService(
				standingManager(
					[CREDENTIAL_IDS.liveApiKey, CREDENTIAL_IDS.liveSession],
					standing
				),
				organizationAccess(standing)
			);

			const revoked = await service.findRevoked(
				[
					storedSession(CREDENTIAL_IDS.liveApiKey),
					storedSession(CREDENTIAL_IDS.liveSession),
				],
				NOW
			);

			assert.deepEqual(
				revoked,
				new Set([CREDENTIAL_IDS.liveApiKey, CREDENTIAL_IDS.liveSession])
			);
		});
	}

	for (const [description, standing, revokedIds] of [
		['keeps writer sessions in good standing', GOOD_STANDING, []],
		[
			'revokes terminal sessions of a member who lost sandbox write',
			{ ...GOOD_STANDING, roleCanWrite: false },
			[CREDENTIAL_IDS.liveApiKey, CREDENTIAL_IDS.liveSession],
		],
		[
			'revokes terminal sessions of an API key without sandbox write',
			{ ...GOOD_STANDING, keyCanWrite: false },
			[CREDENTIAL_IDS.liveApiKey],
		],
	] as const) {
		it(description, async () => {
			const service = new ProtectedAccessSessionStandingService(
				standingManager(
					[CREDENTIAL_IDS.liveApiKey, CREDENTIAL_IDS.liveSession],
					standing
				),
				organizationAccess(standing)
			);

			const revoked = await service.findRevoked(
				[
					storedSession(
						CREDENTIAL_IDS.liveApiKey,
						SYSTEM_EXPOSURE_SERVICE.TERMINAL
					),
					storedSession(
						CREDENTIAL_IDS.liveSession,
						SYSTEM_EXPOSURE_SERVICE.TERMINAL
					),
				],
				NOW
			);

			assert.deepEqual(revoked, new Set(revokedIds));
		});
	}

	it('does not apply the write check to preview sessions', async () => {
		const standing = { ...GOOD_STANDING, roleCanWrite: false };
		const service = new ProtectedAccessSessionStandingService(
			standingManager([CREDENTIAL_IDS.liveSession], standing),
			organizationAccess(standing)
		);

		const revoked = await service.findRevoked(
			[storedSession(CREDENTIAL_IDS.liveSession)],
			NOW
		);

		assert.deepEqual(revoked, new Set());
	});
});
