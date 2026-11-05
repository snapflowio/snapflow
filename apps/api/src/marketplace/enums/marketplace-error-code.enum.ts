/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum MarketplaceErrorCode {
	MACHINE_NOT_FOUND = 'machine_not_found',
	MACHINE_NOT_BENCHMARKED = 'machine_not_benchmarked',
	MACHINE_RESTRICTED = 'machine_restricted',
	MARKET_REFERENCE_MISSING = 'market_reference_missing',
	PRICE_BELOW_FLOOR = 'price_below_floor',
	PRICE_ABOVE_CEILING = 'price_above_ceiling',
	PRICE_CARD_REQUIRED = 'price_card_required',
	PAYOUT_WALLET_REQUIRED = 'payout_wallet_required',
	GPU_RATE_REQUIRED = 'gpu_rate_required',
	PRICE_CLASS_INVALID = 'price_class_invalid',
	LISTING_TRANSITION_INVALID = 'listing_transition_invalid',
	VERSION_CONFLICT = 'version_conflict',
	LEASE_NOT_FOUND = 'lease_not_found',
	LEASE_NOT_OPEN = 'lease_not_open',
	CURSOR_INVALID = 'cursor_invalid',
}
