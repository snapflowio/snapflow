/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Check from '@lucide/svelte/icons/check';
import Play from '@lucide/svelte/icons/play';
import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
import { ExposureBackendState } from '@snapflow/api-client';
import * as z from 'zod';
import type {
	CutoverAction,
	CutoverActionRequest,
} from '#lib/api/admin/cutovers.ts';
import type { ChipConfirmText } from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import type { ChipConfirmCopy } from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';
import {
	adminSearchField,
	adminSortFields,
} from '#lib/features/admin/lib/admin-list.ts';
import { searchParamArray } from '#lib/routing/search-params.ts';
import { titleCase } from '#lib/utils/text.ts';

interface CutoverActionCopy {
	label: string;
	title: string;
	confirm: string;
	pending: string;
}

export const CUTOVER_ACTION_COPY: Record<CutoverAction, CutoverActionCopy> = {
	begin: {
		label: 'Begin cutover',
		title: 'Begin cutover',
		confirm: 'Begin',
		pending: 'Beginning...',
	},
	verify: {
		label: 'Verify and activate',
		title: 'Verify and activate',
		confirm: 'Verify',
		pending: 'Verifying...',
	},
	rollback: {
		label: 'Roll back',
		title: 'Roll back cutover',
		confirm: 'Roll back',
		pending: 'Rolling back...',
	},
};

export const CUTOVER_ACTION_ICONS = {
	begin: Play,
	verify: Check,
	rollback: RotateCcw,
};

export const CUTOVER_ACTION_ORDER: readonly CutoverAction[] = [
	'begin',
	'verify',
	'rollback',
];

export const CUTOVER_SORT_OPTIONS = [
	{ id: 'exposure', label: 'Exposure' },
	{ id: 'started', label: 'Started' },
	{ id: 'verified', label: 'Verified' },
] as const;

export const CUTOVER_STATE_OPTIONS = Object.values(ExposureBackendState).map(
	(state) => ({
		label: titleCase(state),
		value: state,
	})
);

export const CUTOVER_FILTER_KEYS = ['state'] as const;

export const cutoversSearchSchema = z.object({
	q: adminSearchField,
	...adminSortFields(['exposure', 'started', 'verified']),
	state: searchParamArray(z.enum(ExposureBackendState)).catch([]),
});

function cutoverConfirmText(
	request: CutoverActionRequest | null
): ChipConfirmText {
	const exposure = {
		text: request?.cutover.exposureId ?? 'this exposure',
		bold: true,
	};
	switch (request?.action) {
		case 'begin':
			return [
				'Begins a version-fenced DNS cutover of ',
				exposure,
				' to edge ',
				{ text: request.cutover.edgeId, bold: true },
				'.',
			];
		case 'verify':
			return [
				'Checks the canary SLOs for ',
				exposure,
				' and, if they pass, activates the new edge.',
			];
		case 'rollback':
			return [
				'Rolling back ',
				exposure,
				' ',
				{
					text: 'restores the acknowledged predecessor edge.',
					error: true,
				},
			];
		default:
			return [];
	}
}

export function cutoverConfirmCopy(
	request: CutoverActionRequest | null
): ChipConfirmCopy {
	const copy = request ? CUTOVER_ACTION_COPY[request.action] : null;
	return {
		title: copy?.title ?? '',
		text: cutoverConfirmText(request),
		confirmLabel: copy?.confirm ?? '',
		pendingLabel: copy?.pending ?? '',
	};
}
