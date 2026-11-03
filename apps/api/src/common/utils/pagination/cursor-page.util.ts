/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	CursorError,
	type EntityManager,
	type EntityName,
	type FindByCursorOptions,
} from '@mikro-orm/core';
import { BadRequestException } from '@nestjs/common';
import type { CursorPage } from '../../dto/cursor-page.dto';

type CursorPageOptions<Entity extends object, Hint extends string> = Omit<
	FindByCursorOptions<NoInfer<Entity>, Hint, never, never, false>,
	'after' | 'before' | 'first' | 'includeCount' | 'last' | 'overfetch' | 'using'
> & {
	cursor?: string;
	limit: number;
};

export async function findCursorPage<
	Entity extends object,
	Hint extends string = never,
>(
	manager: EntityManager,
	entity: EntityName<Entity>,
	options: CursorPageOptions<Entity, Hint>
): Promise<CursorPage<Entity>> {
	const { cursor, limit, ...findOptions } = options;
	try {
		const page = await manager.findByCursor<Entity, Hint, never, never, false>(
			entity,
			{
				...findOptions,
				...(cursor ? { after: cursor } : {}),
				first: limit,
				includeCount: false,
				overfetch: true,
			}
		);
		return {
			items: [...page],
			nextCursor: page.hasNextPage ? page.endCursor : null,
		};
	} catch (error) {
		if (error instanceof CursorError) {
			throw new BadRequestException('Pagination cursor is invalid');
		}
		throw error;
	}
}
