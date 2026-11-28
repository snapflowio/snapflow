/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Address } from 'viem';
export const DEVELOPMENT_HOST_RATES = {
	vcpuHourMicroUsd: '20000',
	memoryGibHourMicroUsd: '2500',
	gpuHourMicroUsd: '300000',
	diskGibMonthMicroUsd: '100000',
} as const;

export const DEVELOPMENT_PAYOUT_WALLET_ADDRESS =
	'0x70997970C51812dc3A010C7d01b50e0d17dc79C8' satisfies Address;

export const DEVELOPMENT_TIER_REASON = 'development machine seed';
