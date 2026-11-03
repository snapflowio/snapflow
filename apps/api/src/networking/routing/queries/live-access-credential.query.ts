/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { ApiKey } from '../../../auth/entities/api-key.entity';
import { Session } from '../../../auth/entities/session.entity';
import { AUTH_CREDENTIAL_TYPES } from '../../../common/types/organization-auth-context.types';
import type { AccessCredential } from '../utils/protected-access-session.util';

export function accessCredentialKey({ type, id }: AccessCredential): string {
	return `${type}:${id}`;
}

export async function findLiveAccessCredentials(
	manager: EntityManager,
	credentials: readonly AccessCredential[],
	observedAt: Date
): Promise<Set<string>> {
	const idsOf = (type: AccessCredential['type']) => [
		...new Set(
			credentials
				.filter((credential) => credential.type === type)
				.map(({ id }) => id)
		),
	];
	const sessionIds = idsOf(AUTH_CREDENTIAL_TYPES.SESSION);
	const apiKeyIds = idsOf(AUTH_CREDENTIAL_TYPES.API_KEY);
	const unexpired = {
		$or: [{ expiresAt: null }, { expiresAt: { $gt: observedAt } }],
	};
	const [sessions, apiKeys] = await Promise.all([
		sessionIds.length === 0
			? []
			: manager.find(
					Session,
					{ id: { $in: sessionIds }, expiresAt: { $gt: observedAt } },
					{ fields: ['id'] }
				),
		apiKeyIds.length === 0
			? []
			: manager.find(
					ApiKey,
					{ id: { $in: apiKeyIds }, enabled: true, ...unexpired },
					{ fields: ['id'] }
				),
	]);
	return new Set([
		...sessions.map(({ id }) =>
			accessCredentialKey({ type: AUTH_CREDENTIAL_TYPES.SESSION, id })
		),
		...apiKeys.map(({ id }) =>
			accessCredentialKey({ type: AUTH_CREDENTIAL_TYPES.API_KEY, id })
		),
	]);
}
