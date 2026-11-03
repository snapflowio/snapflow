/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const API_KEY_CREATOR_FIELD = 'createdByUserId';

export function apiKeyCreator(metadata: unknown): string | null {
	const parsed = typeof metadata === 'string' ? parseJson(metadata) : metadata;
	if (typeof parsed !== 'object' || parsed === null) return null;
	const creator: unknown = Reflect.get(parsed, API_KEY_CREATOR_FIELD);
	return typeof creator === 'string' ? creator : null;
}

export function storedApiKeyPermissions(
	permissions: unknown
): Record<string, string[]> {
	const parsed =
		typeof permissions === 'string' ? parseJson(permissions) : permissions;
	if (typeof parsed !== 'object' || parsed === null) return {};
	const record: Record<string, string[]> = {};
	for (const [resource, actions] of Object.entries(parsed)) {
		if (Array.isArray(actions)) {
			record[resource] = actions.filter(
				(action): action is string => typeof action === 'string'
			);
		}
	}
	return record;
}

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}
