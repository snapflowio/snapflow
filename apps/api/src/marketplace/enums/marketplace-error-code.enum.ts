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
	GPU_RATE_MISMATCH = 'gpu_rate_mismatch',
	PRICE_CARD_REQUIRED = 'price_card_required',
	PAYOUT_WALLET_REQUIRED = 'payout_wallet_required',
	HOST_TERMS_REQUIRED = 'host_terms_required',
	PRICE_CLASS_INVALID = 'price_class_invalid',
	LISTING_TRANSITION_INVALID = 'listing_transition_invalid',
	VERSION_CONFLICT = 'version_conflict',
	PRICE_NOT_FOUND = 'price_not_found',
	PRICE_NOT_OPEN = 'price_not_open',
}
