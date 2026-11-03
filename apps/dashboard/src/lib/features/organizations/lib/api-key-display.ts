/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ApiKeyListItem } from '#lib/api/organizations/api-keys.ts';
import { timeCell } from '#lib/components/resource/table/time-cell.ts';
import { formatDate } from '#lib/utils/format.ts';

const MASK = '••••••••';
const DESCRIPTION_SEPARATOR = ' · ';

export function apiKeyDescription(apiKey: ApiKeyListItem): string {
	const parts = [apiKey.start ? `${apiKey.start}${MASK}` : MASK];
	if (!apiKey.enabled) parts.push('Disabled');
	if (apiKey.expiresAt) {
		const expiresAt = new Date(apiKey.expiresAt);
		parts.push(
			expiresAt.getTime() <= Date.now()
				? 'Expired'
				: `Expires ${formatDate(expiresAt)}`
		);
	}
	return parts.join(DESCRIPTION_SEPARATOR);
}

export function apiKeyLastUsed(apiKey: ApiKeyListItem): string {
	const label = timeCell(apiKey.lastRequest).label;
	if (!label) return 'last used never';
	return label === 'Now' ? 'last used now' : `last used ${label}`;
}
