<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipInputPrefix from '#lib/components/ui/chip/chip-input-prefix.svelte';
import ChipSwitch from '#lib/components/ui/chip/chip-switch.svelte';
import type { TopUpAmount } from '#lib/features/billing/state/top-up-amount.svelte.ts';

interface TopUpAmountFormProps {
	draft: TopUpAmount;
	disabled?: boolean;
}

let { draft, disabled = false }: TopUpAmountFormProps = $props();

const amountId = $props.id();
const hintId = `${amountId}-hint`;
const errorId = `${amountId}-error`;
</script>

{#snippet dollarPrefix()}
	<ChipInputPrefix>$</ChipInputPrefix>
{/snippet}

<SettingsSection title="Amount">
	<fieldset class="flex flex-col gap-2.25" {disabled}>
		<div class="flex flex-col gap-2 md:flex-row md:items-center">
			{#if draft.presetOptions.length > 0}
				<ChipSwitch
					options={draft.presetOptions}
					value={draft.selectedPreset}
					{disabled}
					aria-label="Preset amounts"
					onChange={draft.selectPreset}
				/>
			{/if}
			<ChipInput
				id={amountId}
				class="md:w-40 md:shrink-0"
				required
				inputmode="decimal"
				placeholder="Custom amount"
				aria-label="Amount"
				aria-describedby={draft.showError ? errorId : hintId}
				bind:value={draft.amount}
				error={draft.showError}
				startAdornment={dollarPrefix}
			/>
		</div>
		{#if draft.showError}
			<p id={errorId} role="alert" class="text-(--text-error) text-caption">
				{draft.error}
			</p>
		{:else}
			<p id={hintId} class="text-(--text-muted) text-caption">{draft.hint}</p>
		{/if}
	</fieldset>
</SettingsSection>
