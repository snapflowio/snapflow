/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { HostMachine, MachineDetail } from '@snapflow/api-client';
import {
	hostMachineSpec,
	type MachineSpec,
	parseWholeNumber,
} from './host-rates.ts';

export const CUSTOM_MACHINE = 'custom';

export type CalculatorSpec = MachineSpec & Pick<MachineDetail, 'diskGiB'>;
type SpecKey = keyof CalculatorSpec;
export type CustomSpecInputs = Record<SpecKey, string>;

const CUSTOM_SPEC_LIMITS = {
	vcpu: { minimum: 1, maximum: 1024 },
	memoryGib: { minimum: 1, maximum: 16_384 },
	gpuCount: { minimum: 0, maximum: 16 },
	diskGiB: { minimum: 1, maximum: 1_048_576 },
} as const satisfies Record<SpecKey, { minimum: number; maximum: number }>;

export const CUSTOM_SPEC_FIELDS = [
	{ key: 'vcpu', label: 'vCPUs', unit: 'vCPU' },
	{ key: 'memoryGib', label: 'Memory', unit: 'GiB' },
	{ key: 'gpuCount', label: 'GPUs', unit: 'GPU' },
	{ key: 'diskGiB', label: 'Disk', unit: 'GiB' },
] as const satisfies readonly { key: SpecKey; label: string; unit: string }[];

export const CUSTOM_SPEC_DEFAULTS: CustomSpecInputs = {
	vcpu: '16',
	memoryGib: '64',
	gpuCount: '0',
	diskGiB: '500',
};

function specValue(inputs: CustomSpecInputs, key: SpecKey): number | null {
	const limits = CUSTOM_SPEC_LIMITS[key];
	return parseWholeNumber(inputs[key], limits.minimum, limits.maximum);
}

export function parseCustomSpec(
	inputs: CustomSpecInputs
): CalculatorSpec | null {
	const vcpu = specValue(inputs, 'vcpu');
	const memoryGib = specValue(inputs, 'memoryGib');
	const gpuCount = specValue(inputs, 'gpuCount');
	const diskGiB = specValue(inputs, 'diskGiB');
	if (
		vcpu === null ||
		memoryGib === null ||
		gpuCount === null ||
		diskGiB === null
	) {
		return null;
	}
	return { vcpu, memoryGib, gpuCount, diskGiB };
}

export function customSpecError(
	inputs: CustomSpecInputs,
	key: SpecKey
): string | null {
	const limits = CUSTOM_SPEC_LIMITS[key];
	return specValue(inputs, key) === null
		? `Use a whole number from ${limits.minimum} to ${limits.maximum}.`
		: null;
}

export function hostMachineCalculatorSpec(
	machine: HostMachine
): CalculatorSpec | null {
	const spec = hostMachineSpec(machine);
	return spec ? { ...spec, diskGiB: machine.diskGiB ?? 0 } : null;
}
