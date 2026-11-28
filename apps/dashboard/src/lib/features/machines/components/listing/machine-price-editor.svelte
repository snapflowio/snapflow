<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Calculator from '@lucide/svelte/icons/calculator';
import type {
	CreatePriceCard,
	HostMachine,
	MachineMarket,
} from '@snapflow/api-client';
import { createMutation } from '@tanstack/svelte-query';
import { quietMutation } from '#lib/api/client/mutation-meta.ts';
import { userErrorMessage } from '#lib/api/errors/api-error-details.ts';
import { publishPriceCardMutationOptions } from '#lib/api/listings.ts';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import { formSubmitHandler } from '#lib/components/form/submit.ts';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import PriceSplitRows from '#lib/features/host-pricing/components/price-split-rows.svelte';
import RateExamplesList from '#lib/features/host-pricing/components/rate-examples-list.svelte';
import RateInput from '#lib/features/host-pricing/components/rate-input.svelte';
import {
	FAT_FINGER_MULTIPLIER,
	hostMachineSpec,
	INTERRUPTIBLE_PERCENT_ERROR,
	initialInterruptiblePercent,
	parseInterruptibleBasisPoints,
	parseRateInputs,
	priceCardBody,
	rateInputError,
	rateInputs,
	ratesFarAboveMarket,
} from '#lib/features/host-pricing/lib/host-rates.ts';
import { wholeMachinePriceSplit } from '#lib/features/host-pricing/lib/price-split.ts';
import { rateExamples } from '#lib/features/host-pricing/lib/rate-examples.ts';
import {
	HOST_PRICE_SHARE_NOTE,
	HOST_RATE_FIELDS,
	hostRateFields,
	marketMedianHint,
} from '#lib/features/host-pricing/lib/rate-fields.ts';
import { Path, resolvePath } from '#lib/routing/paths.ts';
import MachinePriceHistory from './machine-price-history.svelte';

interface MachinePriceEditorProps {
	machine: HostMachine;
	market: MachineMarket;
	onClose: () => void;
}

let { machine, market, onClose }: MachinePriceEditorProps = $props();

const id = $props.id();
const publish = createMutation(() =>
	quietMutation(publishPriceCardMutationOptions())
);
const hasGpus = $derived(machine.gpuCount > 0);
const interruptible = $derived(machine.listing.interruptibleEnabled);
const spec = $derived(hostMachineSpec(machine));
const fields = $derived(hostRateFields(hasGpus));
let reviewing = $state.raw<CreatePriceCard | null>(null);

const form = createAppForm(() => ({
	defaultValues: {
		...rateInputs(machine.currentPriceCard),
		interruptiblePercent: initialInterruptiblePercent(machine.currentPriceCard),
	},
	onSubmit: ({ value }) => {
		const parsed = parseRateInputs(value, hasGpus);
		const interruptibleBasisPoints = interruptible
			? parseInterruptibleBasisPoints(value.interruptiblePercent)
			: undefined;
		if (parsed === null || interruptibleBasisPoints === null) return;
		publish.reset();
		reviewing = priceCardBody(parsed, hasGpus, interruptibleBasisPoints);
	},
}));
const values = form.useStore((state) => state.values);
const rates = $derived(parseRateInputs(values.current, hasGpus));
const interruptibleError = $derived(
	interruptible &&
		parseInterruptibleBasisPoints(values.current.interruptiblePercent) === null
		? INTERRUPTIBLE_PERCENT_ERROR
		: null
);
const examples = $derived(
	rates && spec
		? rateExamples(
				rates,
				spec,
				market.markupBasisPoints,
				machine.listing.gpuOnly
			)
		: []
);
const split = $derived(
	rates && spec
		? wholeMachinePriceSplit(rates, spec, market.markupBasisPoints)
		: null
);
const farAboveLabels = $derived(
	rates
		? ratesFarAboveMarket(rates, market.rates).map(
				(key) =>
					HOST_RATE_FIELDS.find((field) => field.key === key)?.label ?? key
			)
		: []
);
const publishError = $derived(
	publish.error ? userErrorMessage(publish.error) : null
);

function confirmPublish(event: SubmitEvent): void {
	event.preventDefault();
	const price = reviewing;
	if (!price) return;
	publish.mutate(
		{ machineId: machine.machineId, price },
		{
			onSuccess: () => {
				reviewing = null;
				onClose();
			},
		}
	);
}
</script>

{#snippet calculatorInfo()}
	{HOST_PRICE_SHARE_NOTE}
{/snippet}

<form class="contents" onsubmit={formSubmitHandler(form)}>
	<form.AppForm>
		<ChipModalBody>
			{#each fields as rateField (rateField.key)}
				<form.Field name={rateField.key}>
					{#snippet children(field)}
						{const fieldError = $derived(rateInputError(field.state.value))}
						<ChipModalField
							label={`${rateField.label} rate`}
							for={`${id}-${rateField.key}`}
							required
							hint={marketMedianHint(
								market.rates[rateField.key],
								rateField.unit
							)}
							error={fieldError}
							errorId={`${id}-${rateField.key}-error`}
						>
							<RateInput
								id={`${id}-${rateField.key}`}
								name={field.name}
								required
								suffix={`/${rateField.unit}`}
								error={fieldError !== null}
								aria-invalid={fieldError !== null || undefined}
								aria-describedby={fieldError
									? `${id}-${rateField.key}-error`
									: undefined}
								value={field.state.value}
								onblur={field.handleBlur}
								oninput={(event) =>
									field.handleChange(event.currentTarget.value)}
							/>
						</ChipModalField>
					{/snippet}
				</form.Field>
			{/each}
			{#if interruptible}
				<form.Field name="interruptiblePercent">
					{#snippet children(field)}
						<ChipModalField
							label="Interruptible share"
							for={`${id}-interruptible`}
							required
							hint="Share of your compute rates interruptible sandboxes pay."
							error={interruptibleError}
							errorId={`${id}-interruptible-error`}
						>
							<RateInput
								id={`${id}-interruptible`}
								name={field.name}
								required
								prefix=""
								suffix="%"
								inputmode="numeric"
								error={interruptibleError !== null}
								aria-invalid={interruptibleError !== null || undefined}
								aria-describedby={interruptibleError
									? `${id}-interruptible-error`
									: undefined}
								value={field.state.value}
								onblur={field.handleBlur}
								oninput={(event) =>
									field.handleChange(event.currentTarget.value)}
							/>
						</ChipModalField>
					{/snippet}
				</form.Field>
			{/if}
			<div class="flex flex-col gap-7 pt-2">
				{#if examples.length > 0}
					<SettingsSection
						title="Renter pays"
						info="Per hour while each runs. Disk is charged on top at your disk rate."
					>
						<RateExamplesList {examples} />
					</SettingsSection>
				{/if}
				<MachinePriceHistory machineId={machine.machineId} />
			</div>
		</ChipModalBody>
		<ChipModalFooter onCancel={onClose}>
			{#snippet leadingContent()}
				<Chip
					size="compact"
					leftIcon={Calculator}
					href={resolvePath(Path.HOST_PRICING)}
				>
					Rate calculator
				</Chip>
			{/snippet}
			{#snippet primaryAction()}
				<form.SubmitButton
					disabled={rates === null || interruptibleError !== null}
				>
					Review
				</form.SubmitButton>
			{/snippet}
		</ChipModalFooter>
	</form.AppForm>
</form>

<ChipModalConfirm
	bind:open={
		() => reviewing !== null,
		(open) => {
	if (!open) reviewing = null;
}
	}
	title="Publish these rates?"
	text={calculatorInfo}
	pending={publish.isPending}
	error={publishError}
	onsubmit={confirmPublish}
>
	<div class="flex flex-col gap-3">
		{#if farAboveLabels.length > 0}
			<Notice
				tone="warning"
				title={`${farAboveLabels.join(', ')} ${farAboveLabels.length === 1 ? 'is' : 'are'} over ${FAT_FINGER_MULTIPLIER}× the high ask of comparable machines`}
			/>
		{/if}
		{#if split}
			<PriceSplitRows
				{split}
				markupBasisPoints={market.markupBasisPoints}
				label="Whole machine"
			/>
		{/if}
	</div>
	{#snippet confirm()}
		<Chip type="submit" variant="primary" loading={publish.isPending}>
			Publish rates
		</Chip>
	{/snippet}
</ChipModalConfirm>
