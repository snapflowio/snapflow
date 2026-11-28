/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { ORGANIZATION_ROLE_SEPARATOR } from '@snapflow/organization-access';

export interface NoticeAudience {
	roles: readonly string[];
	userIds?: readonly string[];
}

export async function noticeRecipients(
	manager: EntityManager,
	organizationId: string,
	{ roles, userIds = [] }: NoticeAudience
): Promise<string[]> {
	const named = userIds.length > 0;
	const rows = await manager.execute<{ email: string }[]>(
		`SELECT DISTINCT member_user.email
		 FROM member
		 JOIN "user" member_user ON member_user.id = member."userId"
		 WHERE member."organizationId" = ?
		   AND (
			 string_to_array(member.role, ?) && ARRAY[?]::text[]
			 ${named ? `OR member."userId"::text IN (?)` : ''}
		   )
		 ORDER BY member_user.email`,
		[
			organizationId,
			ORGANIZATION_ROLE_SEPARATOR,
			roles,
			...(named ? [userIds] : []),
		]
	);
	return rows.map(({ email }) => email);
}
