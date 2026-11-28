/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type HostMachine,
	type HostMachineEarnings,
	ListingState,
	ListingVisibility,
	type UpdateMachineListing,
} from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import { billingConfigQueryOptions } from '#lib/api/billing/billing.ts';
import { quietMutation } from '#lib/api/client/mutation-meta.ts';
import { userErrorMessage } from '#lib/api/errors/api-error-details.ts';
import {
	acceptHostTermsMutationOptions,
	hostProfileQueryOptions,
} from '#lib/api/host-profile.ts';
import {
	machineVerificationQueryOptions,
	requestBenchmarkMutationOptions,
	updateListingMutationOptions,
} from '#lib/api/listings.ts';
import { hostNetworkUsageSinceQueryOptions } from '#lib/api/machines/machine-egress.ts';
import { getPublicConfig } from '#lib/api/public-config.ts';
import { hostEscrowBalanceQueryOptions } from '#lib/api/settlement/escrow.ts';
import { egressBytes } from '#lib/features/billing/lib/transfer.ts';
import { hostMachineSpec } from '#lib/features/host-pricing/lib/host-rates.ts';
import {
	type PriceSplit,
	wholeMachinePriceSplit,
} from '#lib/features/host-pricing/lib/price-split.ts';
import {
	parseTrafficCap,
	TRAFFIC_CAP_ERROR,
	trafficCapInput,
} from '#lib/features/machines/lib/host-listing.ts';
import {
	ratesEditRequested,
	withoutRatesEdit,
} from '#lib/features/machines/lib/machine-listing-link.ts';
import { listsPublicly } from '#lib/features/machines/lib/machine-listing-status.ts';
import { HostPayoutReadiness } from '#lib/features/machines/state/host-payout-readiness.svelte.ts';
import { getMachineDetail } from '#lib/features/machines/state/machine-detail.svelte.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { goto } from '$app/navigation';
import { page } from '$app/state';

export const ListingBlocker = {
	Rates: 'rates',
	PayoutWallet: 'payout-wallet',
	HostTerms: 'host-terms',
} as const;

export type ListingBlocker =
	(typeof ListingBlocker)[keyof typeof ListingBlocker];

type ListingPatch = Omit<
	Partial<UpdateMachineListing>,
	'state' | 'visibility'
> &
	Partial<Pick<UpdateMachineListing, 'state' | 'visibility'>>;

function monthStart(now: Date): string {
	return new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth())
	).toISOString();
}

export class MachineListingState {
	readonly #detail = getMachineDetail();
	readonly #permission = getOrganizationPermission();
	readonly #legal = getPublicConfig().legal;
	readonly payout = new HostPayoutReadiness();
	readonly #update = createMutation(() => {
		const options = updateListingMutationOptions();
		return { ...options, meta: { ...options.meta, success: undefined } };
	});
	readonly #publish = createMutation(() =>
		quietMutation(updateListingMutationOptions())
	);
	readonly #acceptTerms = createMutation(() =>
		quietMutation(acceptHostTermsMutationOptions())
	);
	readonly benchmark = createMutation(() => requestBenchmarkMutationOptions());
	readonly profile = createQuery(() => hostProfileQueryOptions());
	readonly #config = createQuery(() => billingConfigQueryOptions());
	readonly verification = createQuery(() =>
		machineVerificationQueryOptions(this.#detail.machine.id)
	);
	readonly #balance = createQuery(() => ({
		...hostEscrowBalanceQueryOptions(),
		enabled: this.#permission.can({ payouts: ['read'] }),
	}));
	readonly #egress = createQuery(() =>
		hostNetworkUsageSinceQueryOptions(monthStart(new Date()))
	);

	#ratesOpen = $state(false);
	publishing = $state(false);
	termsChecked = $state(false);
	verificationOpen = $state(false);
	changingWallet = $state(false);
	trafficCapDraft = $state<string | null>(null);
	#publishError = $state<string | null>(null);

	readonly host: HostMachine | undefined = $derived(this.#detail.host);
	readonly loading = $derived(this.#detail.hostMachines.isPending);
	readonly loadError = $derived(this.#detail.hostMachines.error);
	readonly canWrite = $derived(this.#detail.canWriteListings);
	readonly canReadPayouts = $derived(this.payout.canRead);
	readonly saving = $derived(this.#update.isPending);
	readonly markupBasisPoints = $derived(
		this.#config.data?.markupBasisPoints ?? null
	);
	readonly needsTerms = $derived(
		this.profile.data !== undefined &&
			this.profile.data.hostTermsVersion !== this.#legal.hostTermsVersion
	);
	readonly blocker: ListingBlocker | null = $derived.by(() => {
		const host = this.host;
		if (!host) return null;
		if (!host.currentPriceCard) return ListingBlocker.Rates;
		if (this.payout.ready === false) return ListingBlocker.PayoutWallet;
		if (this.needsTerms && !this.canWrite) return ListingBlocker.HostTerms;
		return null;
	});
	readonly canListPublicly = $derived(
		this.host !== undefined &&
			!listsPublicly(this.host) &&
			this.blocker === null &&
			this.canWrite
	);
	readonly earnings: HostMachineEarnings[] = $derived(
		(this.#balance.data?.machines ?? []).filter(
			(machine) => machine.machineId === this.#detail.machine.id
		)
	);
	readonly payoutMinimumMicroUsd = $derived(
		this.#balance.data?.payoutMinimumMicroUsd ?? null
	);
	readonly egressBytes: string | null = $derived.by(() => {
		const periods = this.#egress.data;
		if (!periods) return null;
		return periods
			.filter((period) => period.machineId === this.#detail.machine.id)
			.reduce((total, period) => total + BigInt(egressBytes(period)), 0n)
			.toString();
	});
	readonly split: PriceSplit | null = $derived.by(() => {
		const card = this.host?.currentPriceCard;
		const spec = this.host ? hostMachineSpec(this.host) : null;
		if (!(card && spec) || this.markupBasisPoints === null) return null;
		return wholeMachinePriceSplit(card, spec, this.markupBasisPoints);
	});
	readonly trafficCapText: string = $derived(
		this.trafficCapDraft ??
			trafficCapInput(this.host?.listing.monthlyTrafficCapGb ?? null)
	);
	readonly trafficCapError: string | null = $derived(
		parseTrafficCap(this.trafficCapText) === undefined
			? TRAFFIC_CAP_ERROR
			: null
	);
	readonly publishPending = $derived(
		this.#publish.isPending || this.#acceptTerms.isPending
	);
	readonly publishError: string | null = $derived.by(() => {
		if (this.#publishError) return this.#publishError;
		const failure = this.#publish.error ?? this.#acceptTerms.error;
		return failure ? userErrorMessage(failure) : null;
	});
	readonly publishReady = $derived(!this.needsTerms || this.termsChecked);

	get ratesOpen(): boolean {
		return this.#ratesOpen || (this.canWrite && ratesEditRequested(page.url));
	}

	editRates = (): void => {
		this.#ratesOpen = true;
	};

	closeRates = (): void => {
		this.#ratesOpen = false;
		if (ratesEditRequested(page.url)) {
			void goto(withoutRatesEdit(page.url), { replace: true, reset: false });
		}
	};

	#listing(host: HostMachine, patch: ListingPatch): UpdateMachineListing {
		return {
			state: patch.state ?? host.listing.state,
			visibility: patch.visibility ?? host.listing.visibility,
			gpuOnly: patch.gpuOnly ?? host.listing.gpuOnly,
			interruptibleEnabled:
				patch.interruptibleEnabled ?? host.listing.interruptibleEnabled,
			monthlyTrafficCapGb:
				patch.monthlyTrafficCapGb === undefined
					? host.listing.monthlyTrafficCapGb
					: patch.monthlyTrafficCapGb,
		};
	}

	save = (patch: ListingPatch): void => {
		const host = this.host;
		if (!(host && this.canWrite) || this.saving) return;
		this.#update.mutate({ machine: host, listing: this.#listing(host, patch) });
	};

	setState = (state: ListingState): void => {
		this.save({ state });
	};

	setVisibility = (visibility: ListingVisibility): void => {
		this.save({ visibility });
	};

	commitTrafficCap = (): void => {
		const host = this.host;
		const cap = parseTrafficCap(this.trafficCapText);
		if (!host || cap === undefined) return;
		if (cap !== host.listing.monthlyTrafficCapGb) {
			this.save({ monthlyTrafficCapGb: cap });
		}
		this.trafficCapDraft = null;
	};

	openPublish = (): void => {
		this.#publishError = null;
		this.#publish.reset();
		this.#acceptTerms.reset();
		this.termsChecked = false;
		this.publishing = true;
	};

	confirmPublish = async (): Promise<void> => {
		const host = this.host;
		if (!host || !this.publishReady || this.publishPending) return;
		this.#publishError = null;
		try {
			if (this.needsTerms) {
				await this.#acceptTerms.mutateAsync(this.#legal.hostTermsVersion);
			}
			await this.#publish.mutateAsync({
				machine: host,
				listing: this.#listing(host, {
					state: ListingState.Listed,
					visibility: ListingVisibility.Public,
				}),
			});
			this.publishing = false;
		} catch (error) {
			this.#publishError = userErrorMessage(error);
		}
	};

	requestBenchmark = (): void => {
		this.benchmark.mutate(this.#detail.machine.id);
	};
}
