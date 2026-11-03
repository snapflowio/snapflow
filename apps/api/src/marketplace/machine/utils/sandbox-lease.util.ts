/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { addDays } from '../../../common/utils/time.util';
import { SELF_USE_MARKUP_BASIS_POINTS } from '../constants/marketplace.constants';
import type { MachineListing } from '../entities/machine-listing.entity';
import { ListingState } from '../enums/listing-state.enum';
import { ListingVisibility } from '../enums/listing-visibility.enum';
import { MachineUnavailableReason } from '../enums/machine-unavailable-reason.enum';

export type LeaseListing = Pick<
	MachineListing,
	'state' | 'visibility' | 'currentPriceCardId'
>;

export interface LeaseParties {
	customerOrganizationId: string;
	hostOrganizationId: string;
}

export interface LeaseTerms {
	priceCardId: string | null;
	markupBasisPoints: number;
}

export type LeaseTermsResult =
	| { terms: LeaseTerms; unavailableReason: null }
	| { terms: null; unavailableReason: MachineUnavailableReason };

export function isSelfUse(parties: LeaseParties): boolean {
	return parties.customerOrganizationId === parties.hostOrganizationId;
}

function offered(listing: LeaseListing): boolean {
	return (
		listing.state === ListingState.LISTED &&
		listing.visibility === ListingVisibility.PUBLIC
	);
}

function termsFor(
	parties: LeaseParties,
	listing: LeaseListing,
	markupBasisPoints: number,
	requireOffer: boolean
): LeaseTermsResult {
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

export function openingLeaseTerms(
	parties: LeaseParties,
	listing: LeaseListing,
	markupBasisPoints: number
): LeaseTermsResult {
	return termsFor(parties, listing, markupBasisPoints, true);
}

export function renewalLeaseTerms(
	parties: LeaseParties,
	listing: LeaseListing,
	markupBasisPoints: number
): LeaseTermsResult {
	return termsFor(parties, listing, markupBasisPoints, false);
}

export function priceLockedUntil(startedAt: Date, lockDays: number): Date {
	return addDays(startedAt, lockDays);
}
