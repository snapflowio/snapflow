/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MAX_RELAY_FEE, MIN_AUTO_TOP_UP_INTERVAL } from '@snapflow/contracts';
import { SECONDS_PER_DAY } from '../../common/constants/time.constants';

export const AutoTopUpStatus = {
	DISABLED: 'disabled',
	NOT_AUTHORIZED: 'not_authorized',
	ACTIVE: 'active',
	FAILING: 'failing',
} as const;

export type AutoTopUpStatus =
	(typeof AutoTopUpStatus)[keyof typeof AutoTopUpStatus];

export const AUTO_TOP_UP_TIMES_PER_DAY = {
	minimum: 1,
	maximum: Math.floor(SECONDS_PER_DAY / MIN_AUTO_TOP_UP_INTERVAL),
	default: 4,
} as const;

export const AUTO_TOP_UP_DEFAULT_MAX_RELAY_FEE_MICRO_USD = MAX_RELAY_FEE;

export const AUTO_TOP_UP_FAILURE = {
	RELAY_FEE_ABOVE_CAP:
		"the relay fee for the gas at the current price is above the customer's maximum relay fee",
	TRANSACTION_FAILED: 'the top-up transaction did not go through',
} as const;

export const AUTO_TOP_UP_DEFERRED_REVERTS: ReadonlySet<string> = new Set([
	'AutoTopUpNotNeeded',
	'AutoTopUpTooSoon',
	'EnforcedPause',
]);

export const AutoTopUpErrorCode = {
	AMOUNT_BELOW_MINIMUM_DEPOSIT: 'auto_top_up_amount_below_minimum_deposit',
	THRESHOLD_ZERO: 'auto_top_up_threshold_zero',
	MAX_RELAY_FEE_INVALID: 'auto_top_up_max_relay_fee_invalid',
} as const;
