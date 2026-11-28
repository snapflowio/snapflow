/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type ComputeShape,
	computeHourMicroUsd,
	customerPriceMicroUsd,
	type HostRates,
	type MachineSpec,
	machineShape,
	shapeFits,
} from './host-rates.ts';

interface ExampleSandbox extends ComputeShape {
	label: string;
}

export const EXAMPLE_SANDBOXES = [
	{ label: 'Small sandbox', cpu: 2, memoryGiB: 4, gpu: 0 },
	{ label: 'Medium sandbox', cpu: 4, memoryGiB: 8, gpu: 0 },
	{ label: 'Large sandbox', cpu: 8, memoryGiB: 16, gpu: 0 },
] as const satisfies readonly ExampleSandbox[];

export const GPU_EXAMPLE_SANDBOX = {
	label: 'One GPU',
	cpu: 4,
	memoryGiB: 16,
	gpu: 1,
} as const satisfies ExampleSandbox;

const WHOLE_MACHINE_LABEL = 'Whole machine';

export interface RateExample {
	label: string;
	shape: string;
	hostHourMicroUsd: bigint;
	customerHourMicroUsd: bigint;
}

export function computeShapeLabel(shape: ComputeShape): string {
	return [
		`${shape.cpu} vCPU`,
		`${shape.memoryGiB} GiB`,
		shape.gpu > 0 ? `${shape.gpu} GPU` : null,
	]
		.filter(Boolean)
		.join(' · ');
}

function rateExample(
	label: string,
	shape: ComputeShape,
	rates: HostRates,
	markupBasisPoints: number
): RateExample {
	const hostHourMicroUsd = computeHourMicroUsd(rates, shape);
	return {
		label,
		shape: computeShapeLabel(shape),
		hostHourMicroUsd,
		customerHourMicroUsd: customerPriceMicroUsd(
			hostHourMicroUsd,
			markupBasisPoints
		),
	};
}

export function rateExamples(
	rates: HostRates,
	spec: MachineSpec,
	markupBasisPoints: number,
	gpuOnly = false
): RateExample[] {
	const hasGpus = spec.gpuCount > 0;
	const sandboxes: readonly ExampleSandbox[] = [
		...(gpuOnly && hasGpus ? [] : EXAMPLE_SANDBOXES),
		...(hasGpus ? [GPU_EXAMPLE_SANDBOX] : []),
	];
	return [
		...sandboxes
			.filter((sandbox) => shapeFits(sandbox, spec))
			.map((sandbox) =>
				rateExample(sandbox.label, sandbox, rates, markupBasisPoints)
			),
		rateExample(
			WHOLE_MACHINE_LABEL,
			machineShape(spec),
			rates,
			markupBasisPoints
		),
	];
}
