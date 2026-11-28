/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SELF_USE_MARKUP_BASIS_POINTS } from '../constants/marketplace.constants';
import type { MachineListing } from '../entities/machine-listing.entity';
import { ListingState } from '../enums/listing-state.enum';
import { ListingVisibility } from '../enums/listing-visibility.enum';
import { MachineUnavailableReason } from '../enums/machine-unavailable-reason.enum';

export type PricedListing = Pick<
	MachineListing,
	'state' | 'visibility' | 'currentPriceCardId'
>;

export interface PriceParties {
	customerOrganizationId: string;
	hostOrganizationId: string;
}

interface OfferedPriceTerms {
	priceCardId: string | null;
	markupBasisPoints: number;
}

export type PriceTermsResult =
	| { terms: OfferedPriceTerms; unavailableReason: null }
	| { terms: null; unavailableReason: MachineUnavailableReason };

function isSelfUse(parties: PriceParties): boolean {
	return parties.customerOrganizationId === parties.hostOrganizationId;
}

function offered(listing: PricedListing): boolean {
	return (
		listing.state === ListingState.LISTED &&
		listing.visibility === ListingVisibility.PUBLIC
	);
}

function termsFor(
	parties: PriceParties,
	listing: PricedListing,
	markupBasisPoints: number,
	requireOffer: boolean
): PriceTermsResult {
	if (isSelfUse(parties)) {
		return {
			terms: {
				priceCardId: null,
				markupBasisPoints: SELF_USE_MARKUP_BASIS_POINTS,
			},
			unavailableReason: null,
		};
	}
	if ((requireOffer && !offered(listing)) || !listing.currentPriceCardId) {
		return { terms: null, unavailableReason: MachineUnavailableReason.PAUSED };
	}
	return {
		terms: { priceCardId: listing.currentPriceCardId, markupBasisPoints },
		unavailableReason: null,
	};
}

export function openingPriceTerms(
	parties: PriceParties,
	listing: PricedListing,
	markupBasisPoints: number
): PriceTermsResult {
	return termsFor(parties, listing, markupBasisPoints, true);
}

export function repricedPriceTerms(
	parties: PriceParties,
	listing: PricedListing,
	markupBasisPoints: number
): PriceTermsResult {
	return termsFor(parties, listing, markupBasisPoints, false);
}
