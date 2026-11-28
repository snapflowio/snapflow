/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { CUSTOM_DOMAIN_STATE } from '../../networking/constants/exposure.constants';
import { CUSTOM_DOMAIN_VERIFICATION_EXPIRED } from '../constants/custom-domain.constants';

const RELEASE_UNVERIFIED_SQL = `UPDATE sandbox_custom_domain
	SET state = ?, "desiredGeneration" = "desiredGeneration" + 1,
		"deletionRequestedAt" = now(), "lastError" = ?, "updatedAt" = now()
	WHERE "verificationExpiresAt" < now() AND state <> ?`;

export async function releaseUnverifiedCustomDomains(
	manager: EntityManager
): Promise<void> {
	await manager.execute(RELEASE_UNVERIFIED_SQL, [
		CUSTOM_DOMAIN_STATE.DELETING,
		CUSTOM_DOMAIN_VERIFICATION_EXPIRED,
		CUSTOM_DOMAIN_STATE.DELETING,
	]);
}
