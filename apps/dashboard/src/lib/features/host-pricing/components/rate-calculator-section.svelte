<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const RATE_INFO =
	'A sandbox pays your rates for the vCPUs, memory, GPUs and disk it uses, per second while it runs. Its disk keeps paying while it stays on your machine.';
const WHOLE_MACHINE_INFO =
	'What one sandbox using the whole machine pays. New rates apply to new sandboxes; running ones keep their price until the repricing notice ends.';
</script>

<script lang="ts">
import SettingsRow from '#lib/components/settings/settings-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import {
	CUSTOM_SPEC_FIELDS,
	customSpecError,
} from '#lib/features/host-pricing/lib/calculator.ts';
import {
	INTERRUPTIBLE_PERCENT_ERROR,
	rateInputError,
} from '#lib/features/host-pricing/lib/host-rates.ts';
import {
	hostRateFields,
	marketMedianHint,
} from '#lib/features/host-pricing/lib/rate-fields.ts';
import type { RateCalculator } from '#lib/features/host-pricing/state/rate-calculator.svelte.ts';
import PriceSplitStats from './price-split-stats.svelte';
import RateInput from './rate-input.svelte';

interface RateCalculatorSectionProps {
	calculator: RateCalculator;
}

let { calculator }: RateCalculatorSectionProps = $props();

const fields = $derived(hostRateFields(calculator.hasGpus));
const market = $derived(calculator.marketQuery.data);
const interruptibleError = $derived(
	calculator.interruptibleBasisPoints === null
		? INTERRUPTIBLE_PERCENT_ERROR
		: null
);
</script>

<SettingsSection title="Machine">
	<SettingsRow
		label="Machine"
		description="Start from one of your machines, or describe one."
		layout="split"
	>
		{#snippet control(id)}
			<ChipDropdown
				{id}
				fullWidth
				align="end"
				aria-label="Machine"
				options={calculator.machineOptions}
				value={calculator.machineId}
				onChange={calculator.selectMachine}
			/>
		{/snippet}
	</SettingsRow>
	{#if calculator.machine === null}
		{#each CUSTOM_SPEC_FIELDS as specField (specField.key)}
			<SettingsRow
				label={specField.label}
				layout="split"
				error={customSpecError(calculator.customSpec, specField.key)}
			>
				{#snippet control(id)}
					<RateInput
						{id}
						prefix=""
						suffix={specField.unit}
						inputmode="numeric"
						error={customSpecError(calculator.customSpec, specField.key) !==
							null}
						bind:value={calculator.customSpec[specField.key]}
					/>
				{/snippet}
			</SettingsRow>
		{/each}
	{/if}
</SettingsSection>

<SettingsSection title="Rates" info={RATE_INFO}>
	{#each fields as rateField (rateField.key)}
		<SettingsRow
			label={`${rateField.label} rate`}
			description={market
				? marketMedianHint(market.rates[rateField.key], rateField.unit)
				: undefined}
			layout="split"
			error={rateInputError(calculator.rates[rateField.key])}
		>
			{#snippet control(id)}
				<RateInput
					{id}
					suffix={`/${rateField.unit}`}
					error={rateInputError(calculator.rates[rateField.key]) !== null}
					bind:value={calculator.rates[rateField.key]}
				/>
			{/snippet}
		</SettingsRow>
	{/each}
	<SettingsRow
		label="Interruptible share"
		description="Share of your compute rates interruptible sandboxes pay."
		info="On-demand sandboxes stop interruptible ones when they need the machine."
		layout="split"
		error={interruptibleError}
	>
		{#snippet control(id)}
			<RateInput
				{id}
				prefix=""
				suffix="%"
				inputmode="numeric"
				error={interruptibleError !== null}
				bind:value={calculator.interruptiblePercent}
			/>
		{/snippet}
	</SettingsRow>
	<SettingsRow label="Whole machine" info={WHOLE_MACHINE_INFO} layout="stacked">
		<PriceSplitStats
			split={calculator.split}
			markupBasisPoints={calculator.markupBasisPoints}
		/>
	</SettingsRow>
</SettingsSection>
