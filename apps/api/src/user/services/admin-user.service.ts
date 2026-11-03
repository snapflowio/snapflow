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
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { containsPattern } from '../../common/utils/pagination/like-pattern.util';
import {
	AdminUserDto,
	type AdminUserListQueryDto,
	type AdminUserPageDto,
} from '../dto/admin-user.dto';
import { User } from '../entities/user.entity';

const USERS_WITH_PASSKEYS_SQL =
	'SELECT DISTINCT "userId" FROM "passkey" WHERE "userId" IN (?)';

@Injectable()
export class AdminUserService {
	constructor(private readonly entityManager: EntityManager) {}

	async list(query: AdminUserListQueryDto): Promise<AdminUserPageDto> {
		const search = query.query?.trim();
		const pattern = search ? containsPattern(search) : null;
		const page = await findCursorPage(this.entityManager, User, {
			where: pattern
				? {
						$or: [
							{ name: { $ilike: pattern } },
							{ email: { $ilike: pattern } },
						],
					}
				: {},
			orderBy: { createdAt: 'DESC', id: 'DESC' },
			limit: query.limit,
			cursor: query.cursor,
		});
		const userIds = page.items.map((user) => user.id);
		const withPasskeys = await this.usersWithPasskeys(userIds);
		return {
			items: page.items.map((user) =>
				AdminUserDto.from(user, withPasskeys.has(user.id))
			),
			nextCursor: page.nextCursor,
		};
	}

	private async usersWithPasskeys(
		userIds: readonly string[]
	): Promise<Set<string>> {
		if (userIds.length === 0) return new Set();
		const rows = await this.entityManager.execute<{ userId: string }[]>(
			USERS_WITH_PASSKEYS_SQL,
			[userIds]
		);
		return new Set(rows.map((row) => row.userId));
	}
}
