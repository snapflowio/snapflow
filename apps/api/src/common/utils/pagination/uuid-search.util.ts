/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { raw } from '@mikro-orm/core';
import { containsPattern } from './like-pattern.util';

export function uuidColumnsContaining(
	columns: readonly string[],
	fragment: string
) {
	const pattern = containsPattern(fragment);
	return {
		$or: columns.map((column) => ({
			[raw((alias: string) => `${alias}."${column}"::text`)]: {
				$ilike: pattern,
			},
		})),
	};
}
