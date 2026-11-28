/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { FilterQuery } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { QUERY_ORDERS } from '../../common/constants/sort.constants';
import { AccessDeniedException } from '../../common/exceptions/access-denied.exception';
import { apiError } from '../../common/utils/error/api-error.util';
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { allConditions } from '../../common/utils/pagination/filter-conditions.util';
import { containsPattern } from '../../common/utils/pagination/like-pattern.util';
import {
	AdminUserDto,
	type AdminUserListQueryDto,
	type AdminUserPageDto,
} from '../dto/admin-user.dto';
import { User } from '../entities/user.entity';
import { AdminUserSortField } from '../enums/admin-user-sort-field.enum';
import { AdminUserStatus } from '../enums/admin-user-status.enum';
import { SystemRole } from '../enums/system-role.enum';
import { UserErrorCode } from '../enums/user-error-code.enum';
import {
	LAST_RESTRICTED_EVIDENCE_HOLDER,
	releaseRestrictedEvidenceAccess,
} from '../utils/restricted-evidence-holder.util';
import { userNotFound } from '../utils/user-error.util';

const USERS_WITH_PASSKEYS_SQL =
	'SELECT DISTINCT "userId" FROM "passkey" WHERE "userId" IN (?)';

const SORT_PROPERTIES = {
	[AdminUserSortField.NAME]: 'name',
	[AdminUserSortField.CREATED_AT]: 'createdAt',
} as const satisfies Record<AdminUserSortField, keyof User>;

const BANNED_BY_STATUS = {
	[AdminUserStatus.ACTIVE]: false,
	[AdminUserStatus.BANNED]: true,
} as const satisfies Record<AdminUserStatus, boolean>;

function userFilter(query: AdminUserListQueryDto): FilterQuery<User> {
	const conditions: FilterQuery<User>[] = [];
	const search = query.query?.trim();
	if (search) {
		const pattern = containsPattern(search);
		conditions.push({
			$or: [{ name: { $ilike: pattern } }, { email: { $ilike: pattern } }],
		});
	}
	if (query.roles?.length) {
		conditions.push({ role: { $in: query.roles } });
	}
	if (query.statuses?.length) {
		conditions.push({
			banned: { $in: query.statuses.map((status) => BANNED_BY_STATUS[status]) },
		});
	}
	return allConditions(conditions);
}

@Injectable()
export class AdminUserService {
	constructor(private readonly entityManager: EntityManager) {}

	async list(query: AdminUserListQueryDto): Promise<AdminUserPageDto> {
		const order = QUERY_ORDERS[query.order];
		const page = await findCursorPage(this.entityManager, User, {
			where: userFilter(query),
			orderBy: { [SORT_PROPERTIES[query.sort]]: order, id: order },
			limit: query.limit,
			cursor: query.cursor,
		});
		return {
			items: await this.toDtos(page.items),
			nextCursor: page.nextCursor,
		};
	}

	async get(userId: string): Promise<AdminUserDto> {
		const user = await this.entityManager.findOne(User, { id: userId });
		if (!user) {
			throw new NotFoundException(userNotFound(userId));
		}
		const [dto] = await this.toDtos([user]);
		return dto;
	}

	async setRestrictedEvidenceAccess(
		actorId: string,
		userId: string,
		granted: boolean
	): Promise<AdminUserDto> {
		const user = await this.entityManager
			.fork()
			.transactional(async (manager) => {
				const actor = await manager.findOne(
					User,
					{ id: actorId },
					{ fields: ['restrictedEvidenceAccess'] }
				);
				if (!actor?.restrictedEvidenceAccess) {
					throw new AccessDeniedException();
				}
				const target = await manager.findOne(User, { id: userId });
				if (!target) {
					throw new NotFoundException(userNotFound(userId));
				}
				if (granted && target.role !== SystemRole.ADMIN) {
					throw new BadRequestException(
						apiError(
							UserErrorCode.RESTRICTED_EVIDENCE_ADMIN_ONLY,
							'Only admins can be given restricted evidence access. Make the user an admin first.'
						)
					);
				}
				if (granted) {
					target.restrictedEvidenceAccess = true;
				} else if (
					!(await releaseRestrictedEvidenceAccess(manager, target.id))
				) {
					throw new BadRequestException(LAST_RESTRICTED_EVIDENCE_HOLDER);
				}
				await manager.flush();
				return target;
			});
		const [dto] = await this.toDtos([user]);
		return dto;
	}

	private async toDtos(users: readonly User[]): Promise<AdminUserDto[]> {
		const withPasskeys = await this.usersWithPasskeys(
			users.map((user) => user.id)
		);
		return users.map((user) =>
			AdminUserDto.from(user, withPasskeys.has(user.id))
		);
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
