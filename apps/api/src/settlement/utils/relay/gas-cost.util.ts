/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { etherUnits } from 'viem';
import {
	BASIS_POINTS_DENOMINATOR,
	MICRO_USD_DECIMALS,
} from '../../../common/constants/money.constants';
import {
	ceilDivide,
	decimalScale,
} from '../../../common/utils/fixed-point.util';
import { minBigInt } from '../escrow/escrow-amount.util';

export interface EthUsdPrice {
	answer: bigint;
	decimals: number;
}

export interface GasPricing {
	weiPerGas: bigint;
	ethUsd: EthUsdPrice;
}

export interface RelayPricing extends GasPricing {
	marginBasisPoints: bigint;
}

export interface SettlementFeeQuote {
	baseMicroUsd: bigint;
	perClaimMicroUsd: bigint;
	maximumMicroUsd: bigint;
}

function weiUsdScale({ ethUsd }: GasPricing): bigint {
	return decimalScale(etherUnits.wei + ethUsd.decimals - MICRO_USD_DECIMALS);
}

export function gasCostMicroUsd(gas: bigint, pricing: GasPricing): bigint {
	return ceilDivide(
		gas * pricing.weiPerGas * pricing.ethUsd.answer,
		weiUsdScale(pricing)
	);
}

export function withMargin(amount: bigint, marginBasisPoints: bigint): bigint {
	return ceilDivide(
		amount * (BASIS_POINTS_DENOMINATOR + marginBasisPoints),
		BASIS_POINTS_DENOMINATOR
	);
}

export function settlementRelayFee(
	quote: SettlementFeeQuote,
	claims: number
): bigint {
	return minBigInt(
		quote.baseMicroUsd + quote.perClaimMicroUsd * BigInt(claims),
		quote.maximumMicroUsd
	);
}
