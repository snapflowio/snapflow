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
import { MachineUnavailableReason } from '../enums/machine-unavailable-reason.enum';
import {
	type LeaseListing,
	openingLeaseTerms,
	priceLockedUntil,
	renewalLeaseTerms,
} from './sandbox-lease.util';

const MARKUP_BASIS_POINTS = 2_500;
const CARD_ID = 'card-1';
const CUSTOMER = {
	customerOrganizationId: 'customer',
	hostOrganizationId: 'host',
};
const SELF = {
	customerOrganizationId: 'host',
	hostOrganizationId: 'host',
};
const OFFERED: LeaseListing = {
	state: ListingState.LISTED,
	visibility: ListingVisibility.PUBLIC,
	currentPriceCardId: CARD_ID,
};
const PAUSED: LeaseListing = { ...OFFERED, state: ListingState.PAUSED };
const PRIVATE: LeaseListing = {
	...OFFERED,
	visibility: ListingVisibility.PRIVATE,
};
const UNPRICED_DRAFT: LeaseListing = {
	state: ListingState.DRAFT,
	visibility: ListingVisibility.PRIVATE,
	currentPriceCardId: null,
};

describe('lease opening terms', () => {
	it('locks the current card and the platform markup for another organization', () => {
		assert.deepEqual(
			openingLeaseTerms(CUSTOMER, OFFERED, MARKUP_BASIS_POINTS),
			{
				terms: { priceCardId: CARD_ID, markupBasisPoints: MARKUP_BASIS_POINTS },
				unavailableReason: null,
			}
		);
	});

	it('opens unpriced self-use on any listing of the own machine', () => {
		assert.deepEqual(
			openingLeaseTerms(SELF, UNPRICED_DRAFT, MARKUP_BASIS_POINTS),
			{
				terms: { priceCardId: null, markupBasisPoints: 0 },
				unavailableReason: null,
			}
		);
	});

	it('refuses paused and private listings to other organizations', () => {
		for (const listing of [PAUSED, PRIVATE, UNPRICED_DRAFT]) {
			assert.deepEqual(
				openingLeaseTerms(CUSTOMER, listing, MARKUP_BASIS_POINTS),
				{ terms: null, unavailableReason: MachineUnavailableReason.PAUSED }
			);
		}
	});
});

describe('lease renewal terms', () => {
	it('renews running tenants at the current card while the listing is paused', () => {
		assert.deepEqual(renewalLeaseTerms(CUSTOMER, PAUSED, MARKUP_BASIS_POINTS), {
			terms: { priceCardId: CARD_ID, markupBasisPoints: MARKUP_BASIS_POINTS },
			unavailableReason: null,
		});
	});

	it('cannot renew a priced lease without a current card', () => {
		assert.equal(
			renewalLeaseTerms(CUSTOMER, UNPRICED_DRAFT, MARKUP_BASIS_POINTS)
				.unavailableReason,
			MachineUnavailableReason.PAUSED
		);
	});
});

describe('price lock', () => {
	it('locks the price for the configured number of days', () => {
		assert.deepEqual(
			priceLockedUntil(new Date('2026-10-01T12:00:00Z'), 30),
			new Date('2026-10-31T12:00:00Z')
		);
	});
});
