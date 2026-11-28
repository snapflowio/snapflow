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

export type EdgeConfirmAction = 'drain' | 'disable' | 'reissue';

export interface EdgeConfirmation {
	edge: EdgeDto;
	action: EdgeConfirmAction;
}

export const EDGE_STATUS_ACTIONS = [
	{ status: EdgeStatus.Active, label: 'Activate', confirm: undefined },
	{ status: EdgeStatus.Draining, label: 'Drain', confirm: 'drain' },
	{ status: EdgeStatus.Disabled, label: 'Disable', confirm: 'disable' },
] as const satisfies readonly {
	status: EdgeStatus;
	label: string;
	confirm: EdgeConfirmAction | undefined;
}[];

export const EDGE_CONFIRM_STATUS = {
	drain: EdgeStatus.Draining,
	disable: EdgeStatus.Disabled,
} as const;

const EDGE_CONFIRM_COPY: Record<
	EdgeConfirmAction,
	{ title: string; effect: string; confirm: string }
> = {
	drain: {
		title: 'Drain edge',
		effect:
			'stops taking new exposures but keeps serving the ones it already has.',
		confirm: 'Drain',
	},
	disable: {
		title: 'Disable edge',
		effect:
			'can no longer open a session, so it stops serving traffic until it is activated again.',
		confirm: 'Disable',
	},
	reissue: {
		title: 'Reissue enrollment secret',
		effect:
			'returns to enrolling and its current credentials are revoked, so it stops serving traffic until it enrolls again with the new secret.',
		confirm: 'Reissue',
	},
};

export function edgeConfirmCopy(
	confirmation: EdgeConfirmation | null
): ChipConfirmCopy {
	const copy = EDGE_CONFIRM_COPY[confirmation?.action ?? 'drain'];
	return {
		title: copy.title,
		text: [
			{ text: confirmation?.edge.name ?? 'This edge', bold: true },
			' ',
			{ text: copy.effect, error: true },
		],
		confirmLabel: copy.confirm,
	};
}

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
	};
}
