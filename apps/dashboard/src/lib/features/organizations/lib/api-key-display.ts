/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ApiKeyListItem } from '#lib/api/organizations/api-keys.ts';
import type { BadgeVariant } from '#lib/components/ui/badge.svelte';
import { formatDate } from '#lib/utils/format.ts';
import { relativeTimeLabel } from './relative-time.ts';

export const API_KEY_EXPIRING_SOON_DAYS = 14;

const MILLISECONDS_PER_DAY = 86_400_000;
const MASK = '••••';
const META_SEPARATOR = ' · ';

export type ApiKeyStatus = 'active' | 'expiring' | 'expired' | 'disabled';

interface ApiKeyStatusDisplay {
	label: string;
	badge: BadgeVariant;
}

export const API_KEY_STATUS_DISPLAY: Record<ApiKeyStatus, ApiKeyStatusDisplay> =
	{
		active: { label: 'Active', badge: 'success' },
		expiring: { label: 'Expires soon', badge: 'warning' },
		expired: { label: 'Expired', badge: 'neutral' },
		disabled: { label: 'Disabled', badge: 'neutral' },
	};

export function apiKeyStatus(
	apiKey: ApiKeyListItem,
	now = Date.now()
): ApiKeyStatus {
	if (apiKey.expiresAt) {
		const remaining = new Date(apiKey.expiresAt).getTime() - now;
		if (remaining <= 0) return 'expired';
		if (!apiKey.enabled) return 'disabled';
		return remaining < API_KEY_EXPIRING_SOON_DAYS * MILLISECONDS_PER_DAY
			? 'expiring'
			: 'active';
	}
	return apiKey.enabled ? 'active' : 'disabled';
}

export function apiKeyInactive(status: ApiKeyStatus): boolean {
	return status === 'expired' || status === 'disabled';
}

export function apiKeyPrefix(apiKey: ApiKeyListItem): string {
	return `${apiKey.start ?? ''}${MASK}`;
}

export function apiKeyMeta(apiKey: ApiKeyListItem): string {
	const parts = [
		apiKey.lastRequest
			? `last used ${relativeTimeLabel(apiKey.lastRequest)}`
			: 'never used',
	];
	if (apiKey.expiresAt) {
		const expiresAt = new Date(apiKey.expiresAt);
		parts.push(
			expiresAt.getTime() <= Date.now()
				? `expired ${formatDate(expiresAt)}`
				: `expires ${formatDate(expiresAt)}`
		);
	}
	return parts.join(META_SEPARATOR);
}
