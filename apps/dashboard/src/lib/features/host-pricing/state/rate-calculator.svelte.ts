/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createQuery } from '@tanstack/svelte-query';
import { billingConfigQueryOptions } from '#lib/api/billing/billing.ts';
import {
	allHostMachinesQueryOptions,
	machineMarketQueryOptions,
} from '#lib/api/listings.ts';
import type { ChipOption } from '#lib/components/ui/chip/chip-selection.ts';
import {
	type CalculatorSpec,
	CUSTOM_MACHINE,
	CUSTOM_SPEC_DEFAULTS,
	type CustomSpecInputs,
	hostMachineCalculatorSpec,
	parseCustomSpec,
} from '#lib/features/host-pricing/lib/calculator.ts';
import {
	computeHourMicroUsd,
	type HostRates,
	INTERRUPTIBLE_PERCENT,
	initialInterruptiblePercent,
	interruptibleRates,
	machineShape,
	parseInterruptibleBasisPoints,
	parseRateInputs,
	type RateInputs,
	rateInputs,
} from '#lib/features/host-pricing/lib/host-rates.ts';
import {
	type PriceSplit,
	priceSplit,
} from '#lib/features/host-pricing/lib/price-split.ts';
import {
	type RateExample,
	rateExamples,
} from '#lib/features/host-pricing/lib/rate-examples.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { formatBasisPointsPercent } from '#lib/utils/format.ts';

const CUSTOM_MACHINE_OPTION: ChipOption = {
	label: 'Custom spec',
	value: CUSTOM_MACHINE,
};

export class RateCalculator {
	readonly #permission = getOrganizationPermission();
	readonly #canRead = $derived(this.#permission.can({ listings: ['read'] }));

	machineId = $state<string>(CUSTOM_MACHINE);
	rates = $state<RateInputs>(rateInputs(null));
	interruptiblePercent = $state(String(INTERRUPTIBLE_PERCENT.DEFAULT));
	customSpec = $state<CustomSpecInputs>({ ...CUSTOM_SPEC_DEFAULTS });

	readonly machinesQuery = createQuery(() => ({
		...allHostMachinesQueryOptions(),
		enabled: this.#canRead,
	}));
	readonly configQuery = createQuery(() => billingConfigQueryOptions());

	readonly machine = $derived(
		this.machinesQuery.data?.find(
			(candidate) => candidate.machineId === this.machineId
		) ?? null
	);
	readonly machineOptions: readonly ChipOption[] = $derived([
		CUSTOM_MACHINE_OPTION,
		...(this.machinesQuery.data ?? []).map((machine) => ({
			label: machine.name,
			value: machine.machineId,
		})),
	]);
	readonly marketQuery = createQuery(() => ({
		...machineMarketQueryOptions(this.machine?.machineId ?? CUSTOM_MACHINE),
		enabled: this.machine !== null,
	}));

	readonly spec: CalculatorSpec | null = $derived(
		this.machine
			? hostMachineCalculatorSpec(this.machine)
			: parseCustomSpec(this.customSpec)
	);
	readonly hasGpus = $derived((this.spec?.gpuCount ?? 0) > 0);
	readonly parsedRates: HostRates | null = $derived(
		parseRateInputs(this.rates, this.hasGpus)
	);
	readonly interruptibleBasisPoints = $derived(
		parseInterruptibleBasisPoints(this.interruptiblePercent)
	);
	readonly markupBasisPoints = $derived(
		this.configQuery.data?.markupBasisPoints ?? null
	);
	readonly split: PriceSplit | null = $derived(
		this.parsedRates && this.spec && this.markupBasisPoints !== null
			? priceSplit(
					computeHourMicroUsd(this.parsedRates, machineShape(this.spec)),
					this.markupBasisPoints
				)
			: null
	);
	readonly examples: readonly RateExample[] = $derived.by(() => {
		if (!(this.parsedRates && this.spec) || this.markupBasisPoints === null) {
			return [];
		}
		const examples = rateExamples(
			this.parsedRates,
			this.spec,
			this.markupBasisPoints
		);
		if (this.interruptibleBasisPoints === null) return examples;
		const hostHourMicroUsd = computeHourMicroUsd(
			interruptibleRates(this.parsedRates, this.interruptibleBasisPoints),
			machineShape(this.spec)
		);
		const split = priceSplit(hostHourMicroUsd, this.markupBasisPoints);
		return [
			...examples,
			{
				label: 'Whole machine, interruptible',
				shape: `${formatBasisPointsPercent(this.interruptibleBasisPoints)} of compute`,
				hostHourMicroUsd,
				customerHourMicroUsd: BigInt(split.renterPaysMicroUsd),
			},
		];
	});

	selectMachine = (machineId: string): void => {
		this.machineId = machineId;
		const card = this.machine?.currentPriceCard;
		if (!card) return;
		this.rates = rateInputs(card);
		this.interruptiblePercent = initialInterruptiblePercent(card);
	};
}
