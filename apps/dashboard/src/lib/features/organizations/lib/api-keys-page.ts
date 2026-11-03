/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import * as z from 'zod';
import type { ApiKeyListItem } from '#lib/api/organizations/api-keys.ts';
import type { ChipConfirmCopy } from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';

export const apiKeysSearchSchema = z.object({ search: z.string().catch('') });

export function matchesApiKey(apiKey: ApiKeyListItem, search: string): boolean {
	return (
		!search ||
		(apiKey.name?.toLowerCase().includes(search) ?? false) ||
		(apiKey.start?.toLowerCase().includes(search) ?? false)
	);
}

export function deleteApiKeyCopy(
	apiKey: ApiKeyListItem | null
): ChipConfirmCopy {
	return {
		title: 'Delete API key',
		text: [
			'Deleting ',
			{ text: apiKey?.name ?? 'this key', bold: true },
			' ',
			{
				text: 'will immediately revoke access for any integrations using it.',
				error: true,
			},
			' This action cannot be undone.',
		],
		confirmLabel: 'Delete',
		pendingLabel: 'Deleting...',
	};
}
