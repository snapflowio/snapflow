/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { User } from '../entities/user.entity';

export function isBanActive(
	user: Pick<User, 'banned' | 'banExpires'>,
	now: Date = new Date()
): boolean {
	return user.banned && (user.banExpires === null || user.banExpires > now);
}
