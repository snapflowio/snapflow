/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Ban from '@lucide/svelte/icons/ban';
import Pause from '@lucide/svelte/icons/pause';
import Play from '@lucide/svelte/icons/play';
import { type EdgeDto, EdgeStatus } from '@snapflow/api-client';
import * as z from 'zod';
import type { ChipConfirmCopy } from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';
import {
	adminSearchField,
	adminSortFields,
} from '#lib/features/admin/lib/admin-list.ts';
import { searchParamArray } from '#lib/routing/search-params.ts';
import { titleCase } from '#lib/utils/text.ts';

export const EDGE_STATUS_ACTIONS = [
	{ status: EdgeStatus.Active, label: 'Activate' },
	{ status: EdgeStatus.Draining, label: 'Drain' },
	{ status: EdgeStatus.Disabled, label: 'Disable' },
] as const;

export const EDGE_STATUS_ICONS = {
	[EdgeStatus.Active]: Play,
	[EdgeStatus.Draining]: Pause,
	[EdgeStatus.Disabled]: Ban,
};

export const EDGE_SORT_OPTIONS = [
	{ id: 'name', label: 'Name' },
	{ id: 'heartbeat', label: 'Last heartbeat' },
] as const;

export const EDGE_STATUS_OPTIONS = Object.values(EdgeStatus).map((status) => ({
	label: titleCase(status),
	value: status,
}));

export const EDGE_FILTER_KEYS = ['status'] as const;

export const NEVER_HEARTBEAT_LABEL = 'Never';

export const edgesSearchSchema = z.object({
	q: adminSearchField,
	...adminSortFields(['name', 'heartbeat']),
	status: searchParamArray(z.enum(EdgeStatus)).catch([]),
});

export function deleteEdgeCopy(edge: EdgeDto | null): ChipConfirmCopy {
	return {
		title: 'Delete edge',
		text: [
			'Are you sure you want to delete ',
			{ text: edge?.name ?? 'this edge', bold: true },
			'? ',
			{ text: 'The edge is permanently removed.', error: true },
		],
		confirmLabel: 'Delete',
		pendingLabel: 'Deleting...',
	};
}
