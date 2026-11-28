/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import {
	AUTH_CREDENTIAL_TYPES,
	type AuthCredential,
} from '../../common/types/organization-auth-context.types';
import { Sandbox } from '../entities/sandbox.entity';

export async function attributeToApiKey(
	manager: EntityManager,
	sandbox: Sandbox,
	credential: AuthCredential
): Promise<void> {
	if (credential.type !== AUTH_CREDENTIAL_TYPES.API_KEY) return;
	await manager.nativeUpdate(
		Sandbox,
		{ id: sandbox.id },
		{ apiKeyId: credential.id }
	);
	sandbox.apiKeyId = credential.id;
}
