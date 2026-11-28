/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Path } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';

const EDIT_PARAM = 'edit';
const EDIT_RATES = 'price';

export function machineListingHref(machineId: string): string {
	return resolve('/(app)/(dashboard)/machines/[machineId]/listing', {
		machineId,
	});
}

interface ListingUrl {
	readonly href: string;
	readonly searchParams: Pick<URLSearchParams, 'get'>;
}

export function machineRatesHref(machineId: string): string {
	const search = new URLSearchParams({ [EDIT_PARAM]: EDIT_RATES });
	return `${machineListingHref(machineId)}?${search}`;
}

export function ratesEditRequested(url: ListingUrl): boolean {
	return url.searchParams.get(EDIT_PARAM) === EDIT_RATES;
}

export function withoutRatesEdit(url: ListingUrl): URL {
	const next = new URL(url.href);
	next.searchParams.delete(EDIT_PARAM);
	return next;
}

const LISTED_PARAM = 'listed';
const LISTED_ONLY = 'true';

export function listedMachinesHref(): string {
	const search = new URLSearchParams({ [LISTED_PARAM]: LISTED_ONLY });
	return `${resolve(Path.MACHINES)}?${search}`;
}
