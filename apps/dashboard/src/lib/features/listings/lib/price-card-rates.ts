/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type CreatePriceCard,
	type HostMachine,
	MarketplaceErrorCode,
	type PriceBelowFloorError,
	type PriceFloor,
} from '@snapflow/api-client';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';
import {
	formatHourlyPrice,
	formatMicroUsdAmount,
	usdInputToNonNegativeMicroUsd,
} from '#lib/utils/usd.ts';
import { referencePriceMicroUsd } from './listing-format.ts';

const PRICE_CARD_ERROR_MESSAGES: Partial<Record<MarketplaceErrorCode, string>> =
	{
		[MarketplaceErrorCode.MachineNotBenchmarked]:
			'This machine has not passed a benchmark for its current hardware yet. Request a benchmark from the verification panel first.',
		[MarketplaceErrorCode.MarketReferenceMissing]:
			'No market reference price exists for this machine class yet, so prices cannot be published.',
		[MarketplaceErrorCode.GpuRateRequired]:
			'GPU machines need a GPU rate above zero.',
		[MarketplaceErrorCode.PriceAboveCeiling]:
			'The egress price is above the market ceiling. Lower it to publish this card.',
	};

function isPriceBelowFloor(details: unknown): details is PriceBelowFloorError {
	return (
		typeof details === 'object' &&
		details !== null &&
		'code' in details &&
		details.code === MarketplaceErrorCode.PriceBelowFloor
	);
}

function isMarketplaceErrorCode(
	code: string | null
): code is MarketplaceErrorCode {
	return Object.values<string | null>(MarketplaceErrorCode).includes(code);
}

export function priceCardErrorMessage(error: unknown): string {
	const apiError = SnapflowError.fromUnknown(error);
	if (isPriceBelowFloor(apiError.details)) {
		return `The reference price ${formatHourlyPrice(apiError.details.referencePriceMicroUsd)} is below the market floor of ${formatHourlyPrice(apiError.details.floorMicroUsd)}.`;
	}
	return (
		(isMarketplaceErrorCode(apiError.code)
			? PRICE_CARD_ERROR_MESSAGES[apiError.code]
			: undefined) ?? apiError.message
	);
}

const FREE_EGRESS_INPUT = '0';
const GAUGE_MEDIAN_MULTIPLE = 2n;
const FREE_GPU_INPUT = '0';

export const RATE_FIELDS = [
	{ key: 'vcpuHourMicroUsd', label: 'vCPU', unit: '/vCPU-hour' },
	{
		key: 'memoryGibHourMicroUsd',
		label: 'Memory',
		unit: '/GiB-hour',
	},
	{ key: 'gpuHourMicroUsd', label: 'GPU', unit: '/GPU-hour' },
	{
		key: 'diskGibMonthMicroUsd',
		label: 'Disk while running',
		unit: '/GiB-month',
	},
	{
		key: 'stoppedDiskGibMonthMicroUsd',
		label: 'Disk while stopped',
		unit: '/GiB-month',
	},
] as const satisfies readonly {
	key: keyof CreatePriceCard;
	label: string;
	unit: string;
}[];

export type RateInputs = Record<keyof CreatePriceCard, string>;

export function initialRates(machine: HostMachine): RateInputs {
	const card = machine.currentPriceCard;
	return {
		vcpuHourMicroUsd: card ? formatMicroUsdAmount(card.vcpuHourMicroUsd) : '',
		memoryGibHourMicroUsd: card
			? formatMicroUsdAmount(card.memoryGibHourMicroUsd)
			: '',
		gpuHourMicroUsd: card
			? formatMicroUsdAmount(card.gpuHourMicroUsd)
			: FREE_GPU_INPUT,
		diskGibMonthMicroUsd: card
			? formatMicroUsdAmount(card.diskGibMonthMicroUsd)
			: '',
		stoppedDiskGibMonthMicroUsd: card
			? formatMicroUsdAmount(card.stoppedDiskGibMonthMicroUsd)
			: '',
		egressMicroUsdPerGiB: card
			? formatMicroUsdAmount(card.egressMicroUsdPerGiB)
			: FREE_EGRESS_INPUT,
	};
}

export function parseRates(inputs: RateInputs): CreatePriceCard | null {
	const vcpuHourMicroUsd = usdInputToNonNegativeMicroUsd(
		inputs.vcpuHourMicroUsd
	);
	const memoryGibHourMicroUsd = usdInputToNonNegativeMicroUsd(
		inputs.memoryGibHourMicroUsd
	);
	const gpuHourMicroUsd = usdInputToNonNegativeMicroUsd(inputs.gpuHourMicroUsd);
	const diskGibMonthMicroUsd = usdInputToNonNegativeMicroUsd(
		inputs.diskGibMonthMicroUsd
	);
	const stoppedDiskGibMonthMicroUsd = usdInputToNonNegativeMicroUsd(
		inputs.stoppedDiskGibMonthMicroUsd
	);
	const egressMicroUsdPerGiB = usdInputToNonNegativeMicroUsd(
		inputs.egressMicroUsdPerGiB
	);
	if (
		vcpuHourMicroUsd === null ||
		memoryGibHourMicroUsd === null ||
		gpuHourMicroUsd === null ||
		diskGibMonthMicroUsd === null ||
		stoppedDiskGibMonthMicroUsd === null ||
		egressMicroUsdPerGiB === null
	) {
		return null;
	}
	return {
		vcpuHourMicroUsd,
		memoryGibHourMicroUsd,
		gpuHourMicroUsd,
		diskGibMonthMicroUsd,
		stoppedDiskGibMonthMicroUsd,
		egressMicroUsdPerGiB,
	};
}

export interface FloorPreview {
	belowFloor: boolean;
	gaugeMaximum: number;
	preview: string | null;
}

export function floorPreview(
	rates: CreatePriceCard | null,
	floor: PriceFloor
): FloorPreview {
	const preview = rates
		? referencePriceMicroUsd(rates, floor.referenceShape)
		: null;
	return {
		belowFloor:
			preview !== null && BigInt(preview) < BigInt(floor.floorMicroUsd),
		gaugeMaximum: Number(BigInt(floor.medianMicroUsd) * GAUGE_MEDIAN_MULTIPLE),
		preview,
	};
}

export interface EgressPreview {
	aboveCeiling: boolean;
	egress: string | null;
}

export function egressPreview(
	rates: CreatePriceCard | null,
	floor: PriceFloor
): EgressPreview {
	const egress = rates?.egressMicroUsdPerGiB ?? null;
	return {
		aboveCeiling:
			egress !== null &&
			BigInt(egress) > BigInt(floor.egressCeilingMicroUsdPerGiB),
		egress,
	};
}
