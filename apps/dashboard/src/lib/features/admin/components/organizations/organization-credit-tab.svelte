<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import * as z from 'zod';
import { usdInputToMicroUsd } from '#lib/utils/usd.ts';

const creditGrantSchema = z.object({
	amountUsd: z
		.string()
		.refine(
			(value) => usdInputToMicroUsd(value) !== null,
			'Enter a positive USD amount with at most six decimals'
		),
	reason: z.string().trim().min(1, 'A reason is required'),
});

const EMPTY_CREDIT_GRANT = { amountUsd: '', reason: '' };
</script>

<script lang="ts">
import type { AdminOrganization } from '@snapflow/api-client';
import { revalidateLogic } from '@tanstack/svelte-form';
import { createMutation } from '@tanstack/svelte-query';
import { grantOrganizationCreditMutationOptions } from '#lib/api/admin/organizations.ts';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import { firstFieldError } from '#lib/components/form/field-errors.ts';
import {
	formSubmitHandler,
	submitMutation,
} from '#lib/components/form/submit.ts';
import { saveDiscardActions } from '#lib/components/page/header-actions.ts';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import PageColumn from '#lib/components/page/page-column.svelte';
import ResourceDetailShell from '#lib/components/resource/resource-detail-shell.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import UnsavedChangesGuard from '#lib/components/settings/unsaved-changes-guard.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipInputPrefix from '#lib/components/ui/chip/chip-input-prefix.svelte';
import AdminSettingRow from '#lib/features/admin/components/admin-setting-row.svelte';
import type { OrganizationDetailChrome } from '#lib/features/admin/lib/organization-detail-tabs.ts';
import { formatUsd } from '#lib/utils/usd.ts';

interface OrganizationCreditTabProps {
	chrome: OrganizationDetailChrome;
	organization: AdminOrganization;
}

let { chrome, organization }: OrganizationCreditTabProps = $props();

const formId = $props.id();
const grant = createMutation(() =>
	grantOrganizationCreditMutationOptions(organization.id)
);
const form = createAppForm(() => ({
	defaultValues: EMPTY_CREDIT_GRANT,
	validationLogic: revalidateLogic(),
	validators: { onDynamic: creditGrantSchema },
	onSubmit: async ({ value }) => {
		const amountMicroUsd = usdInputToMicroUsd(value.amountUsd);
		if (amountMicroUsd === null) return;
		const granted = await submitMutation(() =>
			grant.mutateAsync({
				amountMicroUsd: Number(amountMicroUsd),
				reason: value.reason.trim(),
			})
		);
		if (granted) form.reset();
	},
}));
const status = form.useStore((state) => ({
	dirty: !state.isDefaultValue,
	submitting: state.isSubmitting,
}));
const actions = $derived(
	saveDiscardActions({
		dirty: status.current.dirty,
		saving: status.current.submitting,
		onSave: () => {},
		onDiscard: () => form.reset(),
		saveLabel: 'Grant credit',
		savingLabel: 'Granting...',
		form: formId,
	})
);
</script>

{#snippet usdPrefix()}
	<ChipInputPrefix>$</ChipInputPrefix>
{/snippet}

<ResourceDetailShell {...chrome} {actions}>
	<PageColumn>
		<SettingsSection title="Balance">
			<KeyValueList>
				<KeyValueRow>
					{#snippet label()}
						Credit balance
					{/snippet}
					{#snippet value()}
						{formatUsd(organization.creditBalanceMicroUsd)}
					{/snippet}
				</KeyValueRow>
			</KeyValueList>
		</SettingsSection>
		<SettingsSection
			title="Grant credit"
			description="Adds promotional credit to the balance. Grants are recorded in the audit log."
		>
			<form
				id={formId}
				novalidate
				class="flex flex-col gap-5"
				onsubmit={formSubmitHandler(form)}
			>
				<form.Field name="amountUsd">
					{#snippet children(
						field
					)}
						{const fieldError = $derived(
							firstFieldError(field.state.meta.errors)
						)}
						<AdminSettingRow
							label="Amount"
							error={fieldError}
							for={`${formId}-amount`}
						>
							<ChipInput
								id={`${formId}-amount`}
								name={field.name}
								inputmode="decimal"
								placeholder="25.00"
								startAdornment={usdPrefix}
								value={field.state.value}
								onblur={field.handleBlur}
								oninput={(event) =>
									field.handleChange(event.currentTarget.value)}
								error={Boolean(fieldError)}
							/>
						</AdminSettingRow>
					{/snippet}
				</form.Field>
				<form.Field name="reason">
					{#snippet children(
						field
					)}
						{const fieldError = $derived(
							firstFieldError(field.state.meta.errors)
						)}
						<AdminSettingRow
							label="Reason"
							error={fieldError}
							for={`${formId}-reason`}
						>
							<ChipInput
								id={`${formId}-reason`}
								name={field.name}
								placeholder="Support goodwill credit"
								value={field.state.value}
								onblur={field.handleBlur}
								oninput={(event) =>
									field.handleChange(event.currentTarget.value)}
								error={Boolean(fieldError)}
							/>
						</AdminSettingRow>
					{/snippet}
				</form.Field>
			</form>
		</SettingsSection>
	</PageColumn>
</ResourceDetailShell>
<UnsavedChangesGuard
	dirty={status.current.dirty}
	onDiscard={() => form.reset()}
/>
