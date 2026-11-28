/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import { apiError } from '../../common/utils/error/api-error.util';
import { LAST_RESTRICTED_EVIDENCE_HOLDER_MESSAGE } from '../constants/admin-access.constants';
import { User } from '../entities/user.entity';
import { UserErrorCode } from '../enums/user-error-code.enum';

export const LAST_RESTRICTED_EVIDENCE_HOLDER = apiError(
	UserErrorCode.LAST_RESTRICTED_EVIDENCE_HOLDER,
	LAST_RESTRICTED_EVIDENCE_HOLDER_MESSAGE
);

export async function releaseRestrictedEvidenceAccess(
	manager: EntityManager,
	userId: string
): Promise<boolean> {
	const holders = await manager.find(
		User,
		{ restrictedEvidenceAccess: true },
		{ lockMode: LockMode.PESSIMISTIC_WRITE }
	);
	const target = holders.find((holder) => holder.id === userId);
	if (!target) return true;
	if (holders.length === 1) return false;
	target.restrictedEvidenceAccess = false;
	return true;
}
