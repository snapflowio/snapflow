/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type HostMachine, ListingState } from '@snapflow/api-client';
import type { ChipOption } from '#lib/components/ui/chip/chip-selection.ts';
import { LISTING_STATE_LABELS } from './listing-format.ts';

export const LISTING_STATE_OPTIONS: ChipOption<ListingState>[] = Object.values(
	ListingState
).map((state) => ({ label: LISTING_STATE_LABELS[state], value: state }));

export function listingFloorLabel(machine: HostMachine): string {
	if (!machine.currentPriceCard) return 'No price';
	return machine.listing.belowFloorSince ? 'Below floor' : 'Above floor';
}
