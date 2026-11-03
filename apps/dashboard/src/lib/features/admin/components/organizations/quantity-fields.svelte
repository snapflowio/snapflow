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
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import AdminSettingRow from '#lib/features/admin/components/admin-setting-row.svelte';
import type { QuantityForm } from '#lib/features/admin/lib/quantity-form.svelte.ts';

interface QuantityFieldsProps {
	id: string;
	quantityForm: QuantityForm;
}

let { id, quantityForm }: QuantityFieldsProps = $props();

const form = $derived(quantityForm.form);
</script>

<form
	{id}
	novalidate
	class="flex flex-col gap-5"
	onsubmit={formSubmitHandler(form)}
>
	{#each quantityForm.fields as quantity (quantity.name)}
		<form.Field name={quantity.name}>
			{#snippet children(
				field
			)}
				{const inputId = $derived(`${id}-${quantity.name}`)}
				<AdminSettingRow
					label={quantity.label}
					caption={quantity.unit}
					error={firstFieldError(field.state.meta.errors)}
					for={inputId}
				>
					<ChipInput
						id={inputId}
						name={field.name}
						inputmode="numeric"
						placeholder={quantityForm.optionalNames.has(quantity.name)
							? 'No limit'
							: undefined}
						value={field.state.value}
						onblur={field.handleBlur}
						oninput={(event) => field.handleChange(event.currentTarget.value)}
						error={Boolean(firstFieldError(field.state.meta.errors))}
					/>
				</AdminSettingRow>
			{/snippet}
		</form.Field>
	{/each}
</form>
