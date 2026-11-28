/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Cpu from '@lucide/svelte/icons/cpu';
import type { MachineDetail } from '@snapflow/api-client';
import { createQuery } from '@tanstack/svelte-query';
import { createContext } from 'svelte';
import { listingQueryOptions } from '#lib/api/listings.ts';
import Play from '#lib/components/icons/play.svelte';
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import type { ResourceCrumb } from '#lib/components/resource/resource-breadcrumbs.svelte';
import type { ResourceTab } from '#lib/components/resource/resource-tabs.svelte';
import { listingDetailTabs } from '#lib/features/listings/lib/listing-tabs.ts';
import {
	browseShape,
	listingShapeSchema,
} from '#lib/features/listings/lib/machine-browse-params.ts';
import { machineShapeQuery } from '#lib/features/listings/lib/machine-filters.ts';
import { deployOnMachine } from '#lib/features/listings/state/machine-browser.svelte.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { resolve } from '$app/paths';
import { page } from '$app/state';

const DEPLOY_PERMISSION_REASON = 'You need sandbox write access';
const UNAVAILABLE_REASON = "This machine can't take this shape right now";

export class ListingDetail {
	readonly #permission = getOrganizationPermission();
	readonly #shapeParams = new SearchParams(listingShapeSchema);
	readonly #machineId: () => string;
	readonly query;

	readonly #canDeploy = $derived(
		this.#permission.can({ sandboxes: ['write'] })
	);
	readonly listing: MachineDetail | undefined = $derived.by(
		() => this.query.data
	);
	readonly marketplaceCrumb: ResourceCrumb = $derived({
		label: 'Marketplace',
		href: `${resolve(Path.LISTINGS)}${page.url.search}`,
		icon: Cpu,
	});
	readonly crumbs: readonly ResourceCrumb[] = $derived(
		this.listing
			? [this.marketplaceCrumb, { label: this.listing.name }]
			: [this.marketplaceCrumb]
	);
	readonly tabs: readonly ResourceTab[] = $derived.by(() =>
		listingDetailTabs(this.#machineId(), page.route.id, page.url.search)
	);
	readonly #deployReason: string | undefined = $derived.by(() => {
		if (!this.#canDeploy) return DEPLOY_PERMISSION_REASON;
		if (this.listing && !this.listing.available) return UNAVAILABLE_REASON;
		return undefined;
	});
	readonly actions: HeaderAction[] = $derived.by(() => {
		const listing = this.listing;
		if (!listing) return [];
		return [
			{
				id: 'deploy',
				kind: 'primary',
				label: 'Run a sandbox here',
				icon: Play,
				disabled: this.#deployReason !== undefined,
				disabledReason: this.#deployReason,
				onSelect: () => deployOnMachine(listing.machineId),
			},
		];
	});

	get loaded(): MachineDetail {
		const listing = this.query.data;
		if (!listing) {
			throw new Error('The listing detail was read before the listing loaded');
		}
		return listing;
	}

	constructor(machineId: () => string) {
		this.#machineId = machineId;
		this.query = createQuery(() =>
			listingQueryOptions(
				machineId(),
				machineShapeQuery(browseShape(this.#shapeParams.current))
			)
		);
	}
}

export const [getListingDetail, setListingDetail] =
	createContext<ListingDetail>();
