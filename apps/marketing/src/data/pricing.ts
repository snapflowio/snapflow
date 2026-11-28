/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const PRICING = {
	FEE_PERCENT: 20,
	STORAGE_USD_PER_GIB_MONTH: 0.045,
	STORAGE_FREE_GIB: 10,
	MINIMUM_DEPOSIT_USD: 5,
	HOST_PAYOUT_MINIMUM_USD: 10,
} as const;

const USD = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	minimumFractionDigits: 2,
	maximumFractionDigits: 3,
});

export function formatUsd(amount: number): string {
	return USD.format(amount);
}
