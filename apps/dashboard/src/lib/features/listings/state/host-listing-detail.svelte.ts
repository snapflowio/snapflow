/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	HostMachine,
	ListingState,
	ListingVisibility,
} from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	allHostMachinesQueryOptions,
	requestBenchmarkMutationOptions,
	updateListingMutationOptions,
} from '#lib/api/listings.ts';
import { submitMutation } from '#lib/components/form/submit.ts';
import {
	type HeaderAction,
	saveDiscardActions,
} from '#lib/components/page/header-actions.ts';
import { PayoutOnboarding } from '#lib/features/billing/state/payout-onboarding.svelte.ts';
import {
	type ListingBlockers,
	listingBlockers,
} from '#lib/features/listings/lib/host-listing.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';

const NO_BLOCKERS: ListingBlockers = { needsPrice: false, needsPayout: false };

export class HostListingDetail {
	readonly #permission = getOrganizationPermission();
	readonly #onboarding = new PayoutOnboarding();
	readonly #machineId: () => string;
	readonly #updateListing = createMutation(() =>
		updateListingMutationOptions()
	);
	readonly #requestBenchmark = createMutation(() =>
		requestBenchmarkMutationOptions()
	);
	#saving = $state(false);

	readonly back = { label: 'My listings', href: resolve(Path.LISTINGS_MINE) };

	stateDraft = $state<ListingState | null>(null);
	visibilityDraft = $state<ListingVisibility | null>(null);
	pricing = $state.raw<HostMachine | null>(null);

	readonly #canRead = $derived(this.#permission.can({ listings: ['read'] }));
	readonly canWrite = $derived(this.#permission.can({ listings: ['write'] }));
	readonly machinesQuery = createQuery(() => ({
		...allHostMachinesQueryOptions(),
		enabled: this.#canRead,
	}));
	readonly machine: HostMachine | undefined = $derived.by(() =>
		this.machinesQuery.data?.find(
			(candidate) => candidate.machineId === this.#machineId()
		)
	);
	readonly payoutReady: boolean | undefined = $derived.by(() =>
		this.#onboarding.canRead && this.#onboarding.resolved
			? this.#onboarding.ready
			: undefined
	);
	readonly listingState: ListingState | undefined = $derived.by(
		() => this.stateDraft ?? this.machine?.listing.state
	);
	readonly visibility: ListingVisibility | undefined = $derived.by(
		() => this.visibilityDraft ?? this.machine?.listing.visibility
	);
	readonly dirty: boolean = $derived.by(
		() =>
			this.machine !== undefined &&
			(this.listingState !== this.machine.listing.state ||
				this.visibility !== this.machine.listing.visibility)
	);
	readonly blockers: ListingBlockers = $derived.by(() =>
		this.machine && this.listingState && this.visibility
			? listingBlockers(
					this.machine,
					{ state: this.listingState, visibility: this.visibility },
					this.payoutReady
				)
			: NO_BLOCKERS
	);
	readonly #blocked = $derived.by(
		() => this.blockers.needsPrice || this.blockers.needsPayout
	);
	readonly actions: HeaderAction[] = $derived.by(() => {
		const machine = this.machine;
		if (!(machine && this.canWrite)) return [];
		return [
			{
				id: 'benchmark',
				label: 'Request benchmark',
				pending: this.#requestBenchmark.isPending,
				pendingLabel: 'Requesting...',
				disabled: this.#requestBenchmark.isPending,
				onSelect: () => this.#requestBenchmark.mutate(machine.machineId),
			},
			{
				id: 'prices',
				label: 'Edit prices',
				onSelect: () => {
					this.pricing = machine;
				},
			},
			...saveDiscardActions({
				dirty: this.dirty,
				saving: this.#saving,
				onSave: () => void this.save(),
				onDiscard: this.discard,
			}).map((action) =>
				action.id === 'save' && this.#blocked
					? {
							...action,
							disabled: true,
							disabledReason: this.blockers.needsPrice
								? 'Publish prices first'
								: 'Set up payouts first',
						}
					: action
			),
		];
	});

	constructor(machineId: () => string) {
		this.#machineId = machineId;
	}

	discard = (): void => {
		this.stateDraft = null;
		this.visibilityDraft = null;
	};

	save = async (): Promise<void> => {
		const machine = this.machine;
		const listingState = this.listingState;
		const visibility = this.visibility;
		if (
			!(machine && this.dirty && listingState && visibility) ||
			this.#blocked ||
			this.#saving
		)
			return;
		this.#saving = true;
		const saved = await submitMutation(() =>
			this.#updateListing.mutateAsync({
				machine,
				listing: { state: listingState, visibility },
			})
		);
		if (saved) this.discard();
		this.#saving = false;
	};
}
