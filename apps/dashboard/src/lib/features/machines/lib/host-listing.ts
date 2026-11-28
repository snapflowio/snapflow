/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ListingState, ListingVisibility } from '@snapflow/api-client';
import type { ChipSwitchOption } from '#lib/components/ui/chip/chip-switch.svelte';

const WHOLE_NUMBER_PATTERN = /^\d+$/;

export const TRAFFIC_CAP_ERROR =
	'Enter a whole number of GB, or leave it empty for no cap.';

export function trafficCapInput(capGb: number | null): string {
	return capGb === null ? '' : String(capGb);
}

export function parseTrafficCap(input: string): number | null | undefined {
	const trimmed = input.trim();
	if (trimmed === '') return null;
	if (!WHOLE_NUMBER_PATTERN.test(trimmed)) return undefined;
	const capGb = Number(trimmed);
	return capGb > 0 && Number.isSafeInteger(capGb) ? capGb : undefined;
}

export type ListedState =
	| typeof ListingState.Listed
	| typeof ListingState.Paused;

export const LISTING_STATE_SWITCH: readonly ChipSwitchOption<ListedState>[] = [
	{ value: ListingState.Listed, label: 'Listed' },
	{ value: ListingState.Paused, label: 'Paused' },
];

export const LISTING_VISIBILITY_SWITCH: readonly ChipSwitchOption<ListingVisibility>[] =
	[
		{ value: ListingVisibility.Public, label: 'Public' },
		{ value: ListingVisibility.Private, label: 'Private' },
	];

export function listedState(state: ListingState): ListedState {
	return state === ListingState.Listed
		? ListingState.Listed
		: ListingState.Paused;
}
