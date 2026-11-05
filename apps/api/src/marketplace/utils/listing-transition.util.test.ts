/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ListingState } from '../enums/listing-state.enum';
import { ListingVisibility } from '../enums/listing-visibility.enum';
import { MarketplaceErrorCode } from '../enums/marketplace-error-code.enum';
import {
	type ListingFacts,
	listingTransitionError,
	nextListedSince,
} from './listing-transition.util';

const PUBLIC_LISTING = {
	state: ListingState.LISTED,
	visibility: ListingVisibility.PUBLIC,
};
const PRIVATE_LISTING = {
	state: ListingState.LISTED,
	visibility: ListingVisibility.PRIVATE,
};
const PRICED: ListingFacts = {
	currentState: ListingState.DRAFT,
	hasPriceCard: true,
	payoutReady: true,
	restricted: false,
};
const EARLIER = new Date('2026-09-01T00:00:00Z');
const NOW = new Date('2026-10-14T00:00:00Z');

describe('listing transitions', () => {
	it('lists privately without a price card', () => {
		assert.equal(
			listingTransitionError(PRIVATE_LISTING, {
				...PRICED,
				hasPriceCard: false,
			}),
			null
		);
	});

	it('requires a price card to list publicly', () => {
		assert.equal(
			listingTransitionError(PUBLIC_LISTING, {
				...PRICED,
				hasPriceCard: false,
			}),
			MarketplaceErrorCode.PRICE_CARD_REQUIRED
		);
		assert.equal(listingTransitionError(PUBLIC_LISTING, PRICED), null);
	});

	it('requires a ready payout wallet to list publicly', () => {
		const unpaid = { ...PRICED, payoutReady: false };
		assert.equal(
			listingTransitionError(PUBLIC_LISTING, unpaid),
			MarketplaceErrorCode.PAYOUT_WALLET_REQUIRED
		);
		assert.equal(listingTransitionError(PRIVATE_LISTING, unpaid), null);
		assert.equal(
			listingTransitionError(
				{ ...PUBLIC_LISTING, state: ListingState.PAUSED },
				{ ...unpaid, currentState: ListingState.LISTED }
			),
			null
		);
	});

	it('refuses a public listing of a restricted machine', () => {
		assert.equal(
			listingTransitionError(PUBLIC_LISTING, { ...PRICED, restricted: true }),
			MarketplaceErrorCode.MACHINE_RESTRICTED
		);
	});

	it('pauses and resumes but never returns to draft', () => {
		const listed = { ...PRICED, currentState: ListingState.LISTED };
		const paused = { ...PRICED, currentState: ListingState.PAUSED };
		const pause = { ...PUBLIC_LISTING, state: ListingState.PAUSED };
		const draft = { ...PUBLIC_LISTING, state: ListingState.DRAFT };

		assert.equal(listingTransitionError(pause, listed), null);
		assert.equal(listingTransitionError(PUBLIC_LISTING, paused), null);
		assert.equal(
			listingTransitionError(draft, listed),
			MarketplaceErrorCode.LISTING_TRANSITION_INVALID
		);
		assert.equal(listingTransitionError(draft, PRICED), null);
	});

	it('starts the listed-since clock once and resets it when leaving public', () => {
		assert.equal(nextListedSince(PUBLIC_LISTING, null, NOW), NOW);
		assert.equal(nextListedSince(PUBLIC_LISTING, EARLIER, NOW), EARLIER);
		assert.equal(nextListedSince(PRIVATE_LISTING, EARLIER, NOW), null);
	});
});
