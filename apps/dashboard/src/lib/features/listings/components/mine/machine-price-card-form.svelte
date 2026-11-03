<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { HostMachine } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';
import {
	machinePriceCardsQueryOptions,
	machinePriceFloorQueryOptions,
	publishPriceCardMutationOptions,
} from '#lib/api/listings.ts';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import {
	formSubmitHandler,
	submitMutation,
} from '#lib/components/form/submit.ts';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipInputPrefix from '#lib/components/ui/chip/chip-input-prefix.svelte';
import ChipInputSuffix from '#lib/components/ui/chip/chip-input-suffix.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalError from '#lib/components/ui/chip-modal/chip-modal-error.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import { BINARY_UNITS_NOTE } from '#lib/features/billing/lib/transfer.ts';
import {
	initialRates,
	parseRates,
	priceCardErrorMessage,
	RATE_FIELDS,
	type RateInputs,
} from '#lib/features/listings/lib/price-card-rates.ts';
import { formatDateTime } from '#lib/utils/format.ts';
import { formatHourlyPrice } from '#lib/utils/usd.ts';
import PriceCardPreview from './price-card-preview.svelte';

interface MachinePriceCardFormProps {
	machine: HostMachine;
	onClose: () => void;
}

let { machine, onClose }: MachinePriceCardFormProps = $props();

const fieldId = $props.id();
const publish = createMutation(() => publishPriceCardMutationOptions());
const floorQuery = createQuery(() =>
	machinePriceFloorQueryOptions(machine.machineId)
);
const cardsQuery = createQuery(() =>
	machinePriceCardsQueryOptions(machine.machineId)
);
const form = createAppForm(() => ({
	defaultValues: initialRates(machine),
	onSubmit: async ({ value }) => {
		const rates = parseRates(value);
		if (!rates) return;
		if (
			await submitMutation(() =>
				publish.mutateAsync({ machineId: machine.machineId, rates })
			)
		) {
			onClose();
		}
	},
}));
const values = form.useStore((state) => state.values);
const rates = $derived(parseRates(values.current));
const cards = $derived(cardsQuery.data?.items ?? []);
const errorMessage = $derived(
	publish.error ? priceCardErrorMessage(publish.error) : null
);
</script>

{#snippet dollarPrefix()}
	<ChipInputPrefix>$</ChipInputPrefix>
{/snippet}

{#snippet rateField(
	key: keyof RateInputs,
	label: string,
	unit: string,
	hint?: string,
	title?: string
)}
	{const id = $derived(`${fieldId}-${key}`)}
	<form.Field name={key}>
		{#snippet children(
			field
		)}
			<ChipModalField {label} for={id} required {hint} flush>
				<ChipInput
					{id}
					{title}
					name={field.name}
					required
					inputmode="decimal"
					value={field.state.value}
					onblur={field.handleBlur}
					oninput={(event) => field.handleChange(event.currentTarget.value)}
					startAdornment={dollarPrefix}
				>
					{#snippet endAdornment()}
						<ChipInputSuffix>{unit}</ChipInputSuffix>
					{/snippet}
				</ChipInput>
			</ChipModalField>
		{/snippet}
	</form.Field>
{/snippet}

<form class="contents" onsubmit={formSubmitHandler(form)}>
	<form.AppForm>
		<ChipModalBody>
			<p class="px-2 text-(--text-muted) text-caption">
				Customers see one all-in hourly price for their shape. Published cards
				are immutable; running sandboxes keep their locked price until their
				lease renews.
			</p>
			<div class="grid gap-4 px-2 sm:grid-cols-2">
				{#each RATE_FIELDS as rate (rate.key)}
					{@render rateField(rate.key, rate.label, rate.unit)}
				{/each}
				{@render rateField(
					'egressMicroUsdPerGiB',
					'Egress',
					'/GB',
					'Set to $0 to offer free egress. Ingress is never charged.',
					BINARY_UNITS_NOTE
				)}
			</div>
			<div class="flex flex-col gap-7 px-2">
				{#if floorQuery.isSuccess}
					<PriceCardPreview floor={floorQuery.data} {rates} />
				{:else}
					<Notice tone={floorQuery.isError ? 'warning' : 'default'}>
						{#snippet title()}
							{floorQuery.isError
								? 'The market floor is not available'
								: 'Loading the market floor...'}
						{/snippet}
						{#snippet description()}
							{floorQuery.isError
								? SnapflowError.fromUnknown(floorQuery.error).message
								: 'The floor is the lowest reference price a new card may publish.'}
						{/snippet}
					</Notice>
				{/if}
				{#if cards.length > 0}
					<SettingsSection title="Published cards">
						<KeyValueList>
							{#each cards as card (card.id)}
								<KeyValueRow>
									{#snippet label()}
										{`Version ${card.version}`}
									{/snippet}
									{#snippet value()}
										{formatHourlyPrice(card.referencePriceMicroUsd)}
									{/snippet}
									{#snippet detail()}
										{formatDateTime(card.createdAt)}
									{/snippet}
								</KeyValueRow>
							{/each}
						</KeyValueList>
					</SettingsSection>
				{/if}
			</div>
			<ChipModalError message={errorMessage} />
		</ChipModalBody>
		<ChipModalFooter onCancel={onClose}>
			{#snippet primaryAction()}
				<form.SubmitButton pendingLabel="Publishing..." disabled={!rates}>
					Publish
				</form.SubmitButton>
			{/snippet}
		</ChipModalFooter>
	</form.AppForm>
</form>
