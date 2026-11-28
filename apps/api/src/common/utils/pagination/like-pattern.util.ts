/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const LIKE_WILDCARDS = /[\\%_]/g;
const ESCAPED_WILDCARD = '\\$&';

export function containsPattern(fragment: string): string {
	return `%${escapeWildcards(fragment)}%`;
}

export function prefixPattern(fragment: string): string {
	return `${escapeWildcards(fragment)}%`;
}

function escapeWildcards(fragment: string): string {
	return fragment.replaceAll(LIKE_WILDCARDS, ESCAPED_WILDCARD);
}
