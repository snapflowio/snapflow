/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { MachineDetail } from '@snapflow/api-client';
import { createQuery } from '@tanstack/svelte-query';
import { listingQueryOptions } from '#lib/api/listings.ts';
import Play from '#lib/components/icons/play.svelte';
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
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

export class ListingDetail {
	readonly #permission = getOrganizationPermission();
	readonly #shapeParams = new SearchParams(listingShapeSchema);
	readonly query;

	readonly #canDeploy = $derived(
		this.#permission.can({ sandboxes: ['write'] })
	);
	readonly listing: MachineDetail | undefined = $derived.by(
		() => this.query.data
	);
	readonly back = $derived({
		label: 'Listings',
		href: `${resolve(Path.LISTINGS)}${page.url.search}`,
	});
	readonly #deployReason: string | undefined = $derived.by(() => {
		if (!this.#canDeploy)
			return 'Your organization roles do not allow creating sandboxes';
		if (this.listing && !this.listing.available)
			return 'This machine cannot take this shape right now';
		return undefined;
	});
	readonly actions: HeaderAction[] = $derived.by(() => {
		const listing = this.listing;
		if (!listing) return [];
		return [
			{
				id: 'deploy',
				kind: 'primary',
				label: 'Deploy here',
				icon: Play,
				disabled: this.#deployReason !== undefined,
				disabledReason: this.#deployReason,
				onSelect: () => deployOnMachine(listing.machineId),
			},
		];
	});

	constructor(machineId: () => string) {
		this.query = createQuery(() =>
			listingQueryOptions(
				machineId(),
				machineShapeQuery(browseShape(this.#shapeParams.current))
			)
		);
	}
}
