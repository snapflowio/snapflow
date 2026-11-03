/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
import Copy from '@lucide/svelte/icons/copy';
import Gauge from '@lucide/svelte/icons/gauge';
import Pause from '@lucide/svelte/icons/pause';
import Pencil from '@lucide/svelte/icons/pencil';
import {
	type HostMachine,
	ListingState,
	ListingVisibility,
	type UpdateMachineListing,
} from '@snapflow/api-client';
import Credit from '#lib/components/icons/credit.svelte';
import Play from '#lib/components/icons/play.svelte';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import type { BadgeProps } from '#lib/components/ui/badge.svelte';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { formatListingSpecs } from './listing-format.ts';

const NOT_BENCHMARKED_LABEL = 'Not benchmarked';

export const HOST_LISTING_STATE_ORDER = [
	ListingState.Listed,
	ListingState.Paused,
	ListingState.Draft,
] as const satisfies readonly ListingState[];

const LISTING_STATE_BADGES: Record<ListingState, BadgeProps['variant']> = {
	[ListingState.Listed]: 'green',
	[ListingState.Paused]: 'amber',
	[ListingState.Draft]: 'gray-secondary',
};

export function listingStateBadgeVariant(
	state: ListingState
): BadgeProps['variant'] {
	return LISTING_STATE_BADGES[state];
}

export interface ListingBlockers {
	needsPrice: boolean;
	needsPayout: boolean;
}

export function listingBlockers(
	machine: HostMachine,
	listing: UpdateMachineListing,
	payoutReady: boolean | undefined
): ListingBlockers {
	const listsPublicly =
		listing.state === ListingState.Listed &&
		listing.visibility === ListingVisibility.Public;
	return {
		needsPrice: listsPublicly && !machine.currentPriceCard,
		needsPayout: listsPublicly && payoutReady === false,
	};
}

export interface ListingToggle {
	label: string;
	listing: UpdateMachineListing;
	disabled: boolean;
}

export function listingToggle(
	machine: HostMachine,
	payoutReady: boolean | undefined
): ListingToggle {
	const listed = machine.listing.state === ListingState.Listed;
	const listing = {
		state: listed ? ListingState.Paused : ListingState.Listed,
		visibility: machine.listing.visibility,
	};
	const blockers = listingBlockers(machine, listing, payoutReady);
	return {
		label: listed ? 'Pause' : 'List',
		listing,
		disabled: blockers.needsPrice || blockers.needsPayout,
	};
}

export function hostMachineSpecs(machine: HostMachine): string {
	return formatListingSpecs(machine) || NOT_BENCHMARKED_LABEL;
}

export interface HostListingActionHandlers {
	payoutReady: boolean | undefined;
	busy: boolean;
	onOpen: (machine: HostMachine) => void;
	onEditListing?: (machine: HostMachine) => void;
	onEditPrices?: (machine: HostMachine) => void;
	onRequestBenchmark?: (machine: HostMachine) => void;
	onToggle?: (machine: HostMachine, toggle: ListingToggle) => void;
}

export function hostListingRowActions(
	machine: HostMachine,
	handlers: HostListingActionHandlers
): ResourceRowAction[] {
	const toggle = listingToggle(machine, handlers.payoutReady);
	const {
		busy,
		onOpen,
		onEditListing,
		onEditPrices,
		onRequestBenchmark,
		onToggle,
	} = handlers;
	return [
		{
			icon: ArrowUpRight,
			label: 'Open',
			onSelect: () => onOpen(machine),
		},
		{
			icon: Pencil,
			label: 'Edit listing',
			onSelect: () => onEditListing?.(machine),
			visible: Boolean(onEditListing),
		},
		{
			icon: Credit,
			label: 'Edit prices',
			onSelect: () => onEditPrices?.(machine),
			visible: Boolean(onEditPrices),
		},
		{
			icon: Gauge,
			label: 'Request benchmark',
			disabled: busy,
			onSelect: () => onRequestBenchmark?.(machine),
			visible: Boolean(onRequestBenchmark),
		},
		{
			icon: toggle.label === 'Pause' ? Pause : Play,
			label: toggle.label,
			disabled: toggle.disabled || busy,
			onSelect: () => onToggle?.(machine, toggle),
			visible: Boolean(onToggle),
		},
		{
			icon: Copy,
			label: 'Copy ID',
			onSelect: () =>
				void navigator.clipboard
					.writeText(machine.machineId)
					.then(() => toast.success('Machine ID copied')),
		},
	];
}
