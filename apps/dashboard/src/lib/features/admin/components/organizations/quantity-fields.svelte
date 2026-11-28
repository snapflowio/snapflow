<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { firstFieldError } from '#lib/components/form/field-errors.ts';
import { formSubmitHandler } from '#lib/components/form/submit.ts';
import SettingsRow from '#lib/components/settings/settings-row.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipInputSuffix from '#lib/components/ui/chip/chip-input-suffix.svelte';
import { ADMIN_SETTINGS_GROUP_CLASS } from '#lib/features/admin/lib/admin-layout.ts';
import type { QuantityForm } from '#lib/features/admin/lib/quantity-form.svelte.ts';

interface QuantityFieldsProps {
	id: string;
	quantityForm: QuantityForm;
}

let { id, quantityForm }: QuantityFieldsProps = $props();

const NO_LIMIT_PLACEHOLDER = 'No limit';

const form = $derived(quantityForm.form);
</script>

<form
	{id}
	novalidate
	class={ADMIN_SETTINGS_GROUP_CLASS}
	onsubmit={formSubmitHandler(form)}
>
	{#each quantityForm.fields as quantity (quantity.name)}
		<form.Field name={quantity.name}>
			{#snippet children(field)}
				{const inputId = $derived(`${id}-${quantity.name}`)}
				{#snippet unitSuffix()}
					<ChipInputSuffix>{quantity.unit}</ChipInputSuffix>
				{/snippet}
				<SettingsRow
					layout="split"
					label={quantity.label}
					error={firstFieldError(field.state.meta.errors)}
					for={inputId}
				>
					<ChipInput
						id={inputId}
						name={field.name}
						inputmode="numeric"
						placeholder={quantityForm.optionalNames.has(quantity.name)
							? (quantity.placeholder ?? NO_LIMIT_PLACEHOLDER)
							: undefined}
						value={field.state.value}
						onblur={field.handleBlur}
						oninput={(event) => field.handleChange(event.currentTarget.value)}
						error={Boolean(firstFieldError(field.state.meta.errors))}
						endAdornment={unitSuffix}
					/>
				</SettingsRow>
			{/snippet}
		</form.Field>
	{/each}
</form>
