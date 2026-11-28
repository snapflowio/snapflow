<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { FullAutoFill } from 'svelte/elements';
import {
	BILLING_PROFILE_LIMITS,
	type BillingProfileValues,
} from '#lib/features/billing/lib/billing-profile.ts';

interface TextField {
	field: Exclude<keyof BillingProfileValues, 'country'>;
	label: string;
	placeholder?: string;
	autocomplete: FullAutoFill;
	maxlength: number;
	required?: boolean;
}

const NAME_FIELDS: readonly TextField[] = [
	{
		field: 'legalName',
		label: 'Legal name',
		placeholder: 'Company or full name',
		autocomplete: 'organization',
		maxlength: BILLING_PROFILE_LIMITS.LEGAL_NAME,
		required: true,
	},
	{
		field: 'taxId',
		label: 'Tax ID',
		placeholder: 'VAT, GST or EIN number',
		autocomplete: 'off',
		maxlength: BILLING_PROFILE_LIMITS.TAX_ID,
	},
];

const ADDRESS_FIELDS: readonly TextField[] = [
	{
		field: 'addressLine1',
		label: 'Address',
		autocomplete: 'address-line1',
		maxlength: BILLING_PROFILE_LIMITS.ADDRESS_LINE,
		required: true,
	},
	{
		field: 'addressLine2',
		label: 'Address line 2',
		placeholder: 'Apartment, suite or building',
		autocomplete: 'address-line2',
		maxlength: BILLING_PROFILE_LIMITS.ADDRESS_LINE,
	},
	{
		field: 'city',
		label: 'City',
		autocomplete: 'address-level2',
		maxlength: BILLING_PROFILE_LIMITS.CITY,
		required: true,
	},
	{
		field: 'postalCode',
		label: 'Postal code',
		autocomplete: 'postal-code',
		maxlength: BILLING_PROFILE_LIMITS.POSTAL_CODE,
	},
	{
		field: 'region',
		label: 'State or region',
		autocomplete: 'address-level1',
		maxlength: BILLING_PROFILE_LIMITS.REGION,
	},
];
</script>

<script lang="ts">
import type { BillingProfile } from '@snapflow/api-client';
import { createMutation } from '@tanstack/svelte-query';
import { watch } from 'runed';
import { updateBillingProfileMutationOptions } from '#lib/api/billing/receipts.ts';
import { userErrorMessage } from '#lib/api/errors/api-error-details.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalError from '#lib/components/ui/chip-modal/chip-modal-error.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import { BillingProfileDraft } from '#lib/features/billing/state/billing-profile-draft.svelte.ts';
import { COUNTRY_OPTIONS } from '#lib/utils/countries.ts';

interface BillingDetailsModalProps {
	open?: boolean;
	profile: BillingProfile | null;
}

let { open = $bindable(false), profile }: BillingDetailsModalProps = $props();

const fieldId = $props.id();
const save = createMutation(() => updateBillingProfileMutationOptions());
const draft = new BillingProfileDraft();
const pending = $derived(save.isPending);
const failure = $derived(save.isError ? userErrorMessage(save.error) : null);

watch(
	() => open,
	(isOpen) => {
		if (!isOpen) return;
		draft.reset(profile);
		save.reset();
	}
);

function close(): void {
	if (pending) return;
	open = false;
}

function submit(event: SubmitEvent): void {
	event.preventDefault();
	if (pending) return;
	const body = draft.validate();
	if (!body) return;
	save.mutate(body, {
		onSuccess: () => {
			draft.commit();
			open = false;
		},
	});
}
</script>

{#snippet textField(row: TextField)}
	{const id = $derived(`${fieldId}-${row.field}`)}
	<ChipModalField
		label={row.label}
		for={id}
		required={row.required}
		error={draft.errors[row.field]}
	>
		<ChipInput
			{id}
			class="w-full"
			bind:value={draft.values[row.field]}
			placeholder={row.placeholder}
			autocomplete={row.autocomplete}
			maxlength={row.maxlength}
			error={draft.errors[row.field] !== undefined}
			disabled={pending}
		/>
	</ChipModalField>
{/snippet}

<ChipModal
	bind:open
	srTitle="Billing details"
	dismissDisabled={pending}
	hasUnsavedInput={draft.dirty}
	onsubmit={submit}
>
	<ChipModalHeader onClose={close} closeDisabled={pending}>
		Billing details
	</ChipModalHeader>
	<ChipModalBody>
		{#each NAME_FIELDS as row (row.field)}
			{@render textField(row)}
		{/each}
		{#each ADDRESS_FIELDS as row (row.field)}
			{@render textField(row)}
		{/each}
		<ChipModalField
			label="Country"
			for={`${fieldId}-country`}
			required
			error={draft.errors.country}
		>
			<ChipDropdown
				id={`${fieldId}-country`}
				fullWidth
				aria-label="Country"
				aria-invalid={draft.errors.country !== undefined}
				placeholder="Select a country"
				options={COUNTRY_OPTIONS}
				searchable
				searchPlaceholder="Search countries"
				disabled={pending}
				value={draft.values.country}
				onChange={(country: string) => {
					draft.values.country = country;
				}}
			/>
		</ChipModalField>
		<ChipModalError message={failure} />
	</ChipModalBody>
	<ChipModalFooter onCancel={close} cancelDisabled={pending}>
		{#snippet primaryAction()}
			<Chip
				type="submit"
				variant="primary"
				loading={pending}
				disabled={!draft.dirty}
			>
				Save
			</Chip>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
