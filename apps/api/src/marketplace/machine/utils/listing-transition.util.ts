/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ListingState } from '../enums/listing-state.enum';
import { ListingVisibility } from '../enums/listing-visibility.enum';
import { MarketplaceErrorCode } from '../enums/marketplace-error-code.enum';

export interface ListingTarget {
	state: ListingState;
	visibility: ListingVisibility;
}

export interface ListingFacts {
	currentState: ListingState;
	hasPriceCard: boolean;
	payoutReady: boolean;
	restricted: boolean;
}

export function isListedPublicly(listing: ListingTarget): boolean {
	return (
		listing.state === ListingState.LISTED &&
		listing.visibility === ListingVisibility.PUBLIC
	);
}

export function listingTransitionError(
	target: ListingTarget,
	facts: ListingFacts
): MarketplaceErrorCode | null {
	if (
		target.state === ListingState.DRAFT &&
		facts.currentState !== ListingState.DRAFT
	) {
		return MarketplaceErrorCode.LISTING_TRANSITION_INVALID;
	}
	if (!isListedPublicly(target)) return null;
	if (!facts.hasPriceCard) return MarketplaceErrorCode.PRICE_CARD_REQUIRED;
	if (!facts.payoutReady) return MarketplaceErrorCode.PAYOUT_ACCOUNT_REQUIRED;
	return facts.restricted ? MarketplaceErrorCode.MACHINE_RESTRICTED : null;
}

export function nextListedSince(
	target: ListingTarget,
	listedSince: Date | null,
	now: Date
): Date | null {
	return isListedPublicly(target) ? (listedSince ?? now) : null;
}
