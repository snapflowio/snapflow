/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	CreatePriceCard,
	HostMachine,
	MachineMarketRates,
	PriceCard,
	SandboxPrice,
} from '@snapflow/api-client';
import { BPS_DENOMINATOR } from '@snapflow/contracts';
import { formatMicroUsdAmount, usdInputToMicroUsd } from '#lib/utils/usd.ts';

const BASIS_POINTS = BigInt(BPS_DENOMINATOR);
const RESOURCE_SCALE = 1_000_000;
const RESOURCE_FACTOR = BigInt(RESOURCE_SCALE);
const PERCENT = 100;
const WHOLE_NUMBER_PATTERN = /^\d+$/;

export type HostRateKey = keyof MachineMarketRates;
export type HostRates = Pick<PriceCard, HostRateKey>;
export type RateInputs = Record<HostRateKey, string>;
export type ComputeShape = Pick<SandboxPrice, 'cpu' | 'memoryGiB' | 'gpu'>;
export type MachineSpec = Pick<PriceCard, 'vcpu' | 'memoryGib' | 'gpuCount'>;

export const HOST_RATE_KEYS = [
	'vcpuHourMicroUsd',
	'memoryGibHourMicroUsd',
	'gpuHourMicroUsd',
	'diskGibMonthMicroUsd',
] as const satisfies readonly HostRateKey[];

export const NO_GPU_RATE = '0';

export const FAT_FINGER_MULTIPLIER = 3n;

export const INTERRUPTIBLE_PERCENT = {
	DEFAULT: 50,
	MINIMUM: 1,
	MAXIMUM: 100,
} as const;

export const INTERRUPTIBLE_PERCENT_ERROR = `Use a whole percent from ${INTERRUPTIBLE_PERCENT.MINIMUM} to ${INTERRUPTIBLE_PERCENT.MAXIMUM}.`;

export const RATE_INPUT_ERROR = 'Enter a dollar amount above zero, like 0.012.';

const BASIS_POINTS_PER_PERCENT = BPS_DENOMINATOR / PERCENT;

function ceilDivide(numerator: bigint, denominator: bigint): bigint {
	return (numerator + denominator - 1n) / denominator;
}

function scaled(quantity: number): bigint {
	return BigInt(Math.round(quantity * RESOURCE_SCALE));
}

export function computeHourMicroUsd(
	rates: HostRates,
	shape: ComputeShape
): bigint {
	return ceilDivide(
		BigInt(rates.vcpuHourMicroUsd) * scaled(shape.cpu) +
			BigInt(rates.memoryGibHourMicroUsd) * scaled(shape.memoryGiB) +
			BigInt(rates.gpuHourMicroUsd) * scaled(shape.gpu),
		RESOURCE_FACTOR
	);
}

export function hostMachineSpec(
	machine: Pick<
		HostMachine,
		'vcpu' | 'memoryGiB' | 'gpuCount' | 'currentPriceCard'
	>
): MachineSpec | null {
	if (!(machine.vcpu && machine.memoryGiB)) return machine.currentPriceCard;
	return {
		vcpu: machine.vcpu,
		memoryGib: machine.memoryGiB,
		gpuCount: machine.gpuCount,
	};
}

export function machineShape(spec: MachineSpec): ComputeShape {
	return { cpu: spec.vcpu, memoryGiB: spec.memoryGib, gpu: spec.gpuCount };
}

export function shapeFits(shape: ComputeShape, spec: MachineSpec): boolean {
	return (
		shape.cpu <= spec.vcpu &&
		shape.memoryGiB <= spec.memoryGib &&
		shape.gpu <= spec.gpuCount
	);
}

export function customerPriceMicroUsd(
	hostMicroUsd: bigint,
	markupBasisPoints: number
): bigint {
	return ceilDivide(
		hostMicroUsd * (BASIS_POINTS + BigInt(markupBasisPoints)),
		BASIS_POINTS
	);
}

export function interruptibleRates(
	rates: HostRates,
	interruptibleBasisPoints: number
): HostRates {
	const share = BigInt(interruptibleBasisPoints);
	const discounted = (rate: string): string =>
		((BigInt(rate) * share) / BASIS_POINTS).toString();
	return {
		vcpuHourMicroUsd: discounted(rates.vcpuHourMicroUsd),
		memoryGibHourMicroUsd: discounted(rates.memoryGibHourMicroUsd),
		gpuHourMicroUsd: discounted(rates.gpuHourMicroUsd),
		diskGibMonthMicroUsd: rates.diskGibMonthMicroUsd,
	};
}

export function rateInputValue(microUsd: string): string {
	return formatMicroUsdAmount(microUsd);
}

export function rateInputs(rates: HostRates | null): RateInputs {
	return {
		vcpuHourMicroUsd: rates ? rateInputValue(rates.vcpuHourMicroUsd) : '',
		memoryGibHourMicroUsd: rates
			? rateInputValue(rates.memoryGibHourMicroUsd)
			: '',
		gpuHourMicroUsd:
			rates && rates.gpuHourMicroUsd !== NO_GPU_RATE
				? rateInputValue(rates.gpuHourMicroUsd)
				: '',
		diskGibMonthMicroUsd: rates
			? rateInputValue(rates.diskGibMonthMicroUsd)
			: '',
	};
}

export function rateInputError(text: string): string | null {
	return text.trim() === '' || usdInputToMicroUsd(text) !== null
		? null
		: RATE_INPUT_ERROR;
}

export function parseRateInputs(
	inputs: RateInputs,
	hasGpus: boolean
): HostRates | null {
	const vcpuHourMicroUsd = usdInputToMicroUsd(inputs.vcpuHourMicroUsd);
	const memoryGibHourMicroUsd = usdInputToMicroUsd(
		inputs.memoryGibHourMicroUsd
	);
	const gpuHourMicroUsd = hasGpus
		? usdInputToMicroUsd(inputs.gpuHourMicroUsd)
		: NO_GPU_RATE;
	const diskGibMonthMicroUsd = usdInputToMicroUsd(inputs.diskGibMonthMicroUsd);
	if (
		vcpuHourMicroUsd === null ||
		memoryGibHourMicroUsd === null ||
		gpuHourMicroUsd === null ||
		diskGibMonthMicroUsd === null
	) {
		return null;
	}
	return {
		vcpuHourMicroUsd,
		memoryGibHourMicroUsd,
		gpuHourMicroUsd,
		diskGibMonthMicroUsd,
	};
}

export function parseWholeNumber(
	text: string,
	minimum: number,
	maximum: number
): number | null {
	const trimmed = text.trim();
	if (!WHOLE_NUMBER_PATTERN.test(trimmed)) return null;
	const value = Number(trimmed);
	return value >= minimum && value <= maximum ? value : null;
}

export function initialInterruptiblePercent(card: PriceCard | null): string {
	return String(
		card
			? card.interruptibleBasisPoints / BASIS_POINTS_PER_PERCENT
			: INTERRUPTIBLE_PERCENT.DEFAULT
	);
}

export function parseInterruptibleBasisPoints(text: string): number | null {
	const percent = parseWholeNumber(
		text,
		INTERRUPTIBLE_PERCENT.MINIMUM,
		INTERRUPTIBLE_PERCENT.MAXIMUM
	);
	return percent === null ? null : percent * BASIS_POINTS_PER_PERCENT;
}

export function priceCardBody(
	rates: HostRates,
	hasGpus: boolean,
	interruptibleBasisPoints: number | undefined
): CreatePriceCard {
	return {
		vcpuHourMicroUsd: rates.vcpuHourMicroUsd,
		memoryGibHourMicroUsd: rates.memoryGibHourMicroUsd,
		...(hasGpus ? { gpuHourMicroUsd: rates.gpuHourMicroUsd } : {}),
		diskGibMonthMicroUsd: rates.diskGibMonthMicroUsd,
		interruptibleBasisPoints,
	};
}

export function ratesFarAboveMarket(
	rates: HostRates,
	market: MachineMarketRates
): HostRateKey[] {
	return HOST_RATE_KEYS.filter((key) => {
		const percentiles = market[key];
		return (
			percentiles !== null &&
			BigInt(rates[key]) > BigInt(percentiles.high) * FAT_FINGER_MULTIPLIER
		);
	});
}
