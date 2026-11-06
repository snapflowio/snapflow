<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { SandboxClass, type Settings } from '@snapflow/api-client';
import type {
	SettingField,
	SettingsSection,
} from '#lib/features/admin/lib/settings/settings-fields.ts';
import {
	EDGE_INGRESS_SECTION,
	HOST_PRICE_LIMITS_SECTION,
	MACHINE_POLICY_SECTION,
	MACHINE_REGISTRY_SECTION,
	MARKETPLACE_SECTION,
	PRICING_SECTION,
	QUOTA_SECTION,
	SETTLEMENT_SECTION,
	VERIFICATION_SECTION,
} from '#lib/features/admin/lib/settings/settings-sections.ts';
import { formatDateTime } from '#lib/utils/format.ts';

const SANDBOX_CLASS_OPTIONS = Object.values(SandboxClass).map(
	(sandboxClass) => ({ label: sandboxClass, value: sandboxClass })
);
const LIST_ROWS = 4;

const DEFAULTS_SECTION: SettingsSection = {
	title: 'Defaults',
	note: 'Applies to accounts and sandboxes created after saving.',
	fields: [
		{
			kind: 'choice',
			name: 'defaultSandboxClass',
			label: 'Default sandbox class',
			options: SANDBOX_CLASS_OPTIONS,
		},
		{
			kind: 'text',
			name: 'defaultSnapshot',
			label: 'Default snapshot',
			optional: true,
			placeholder: 'docker.io/library/ubuntu:24.04',
			hint: 'Image imported as every account’s default snapshot. Leave empty for none.',
		},
		{
			kind: 'switch',
			name: 'sandboxDefaultLimitedNetworkEgress',
			label: 'Limited network egress',
			description:
				'New accounts start with restricted outbound bandwidth for their sandboxes.',
		},
	],
};

function settingsDescription(settings: Settings): string {
	const updated = `Version ${settings.resourceVersion} · Updated ${formatDateTime(settings.updatedAt)}`;
	return settings.updatedBy ? `${updated} by ${settings.updatedBy}` : updated;
}

function fieldCaption(field: SettingField): string | undefined {
	switch (field.kind) {
		case 'quantity':
			return field.unit;
		case 'list':
			return field.hint ?? 'One per line';
		case 'text':
			return field.hint;
		case 'switch':
			return field.description;
		default:
			return undefined;
	}
}

function isStacked(field: SettingField): boolean {
	return field.kind === 'list' || field.kind === 'text';
}
</script>

<script lang="ts">
import { revalidateLogic } from '@tanstack/svelte-form';
import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import {
	isSettingsVersionConflict,
	reloadAdminSettings,
	updateSettingsMutationOptions,
} from '#lib/api/admin/platform-settings.ts';
import { showApiError } from '#lib/api/errors/show-api-error.ts';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import { firstFieldError } from '#lib/components/form/field-errors.ts';
import {
	formSubmitHandler,
	submitMutation,
} from '#lib/components/form/submit.ts';
import { saveDiscardActions } from '#lib/components/page/header-actions.ts';
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import SettingsSectionView from '#lib/components/settings/settings-section.svelte';
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipTextarea from '#lib/components/ui/chip/chip-textarea.svelte';
import Label from '#lib/components/ui/label.svelte';
import Switch from '#lib/components/ui/switch.svelte';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import AdminSettingRow from '#lib/features/admin/components/admin-setting-row.svelte';
import {
	changedSettings,
	settingFormValues,
} from '#lib/features/admin/lib/settings/settings-fields.ts';
import { settingFormSchema } from '#lib/features/admin/lib/settings/settings-validators.ts';
import OperationsSection from './operations-section.svelte';
import PlatformRegistriesSection from './platform-registries-section.svelte';

interface AdminSettingsFormProps {
	settings: Settings;
}

let { settings }: AdminSettingsFormProps = $props();

const formId = $props.id();
const queryClient = useQueryClient();
const updateSettings = createMutation(() =>
	updateSettingsMutationOptions(queryClient)
);
const sections: readonly SettingsSection[] = $derived([
	DEFAULTS_SECTION,
	QUOTA_SECTION,
	PRICING_SECTION,
	HOST_PRICE_LIMITS_SECTION,
	MARKETPLACE_SECTION,
	VERIFICATION_SECTION,
	SETTLEMENT_SECTION,
	EDGE_INGRESS_SECTION,
	MACHINE_REGISTRY_SECTION,
	MACHINE_POLICY_SECTION,
]);
const fields = $derived(sections.flatMap((section) => section.fields));
const initialValues = $derived(settingFormValues(settings, fields));

async function handleSaveError(error: Error): Promise<void> {
	if (!isSettingsVersionConflict(error)) {
		showApiError(error, 'Failed to save settings');
		return;
	}
	await reloadAdminSettings(queryClient);
	toast.error('Settings changed elsewhere', {
		description:
			'Another administrator saved first. The latest settings were loaded; review them and save again.',
	});
}

const form = createAppForm(() => ({
	defaultValues: initialValues,
	validationLogic: revalidateLogic(),
	validators: { onDynamic: settingFormSchema(fields) },
	onSubmit: async ({ value }) => {
		const changes = changedSettings(fields, initialValues, value);
		if (Object.keys(changes).length === 0) return;
		const saved = await submitMutation(() =>
			updateSettings.mutateAsync(
				{ changes, settings },
				{ onError: handleSaveError }
			)
		);
		if (saved) form.reset(value);
	},
}));
const status = form.useStore((state) => ({
	values: state.values,
	submitting: state.isSubmitting,
}));
const dirty = $derived(
	Object.keys(changedSettings(fields, initialValues, status.current.values))
		.length > 0
);
const actions = $derived(
	saveDiscardActions({
		dirty,
		saving: status.current.submitting,
		onSave: () => {},
		onDiscard: () => form.reset(initialValues),
		form: formId,
	})
);
</script>

{#snippet settingControl(
	setting: SettingField
)}
	<form.Field name={setting.name}>
		{#snippet children(
			field
		)}
			{const controlId = $derived(`${formId}-${setting.name}`)}
			{const fieldError = $derived(firstFieldError(field.state.meta.errors))}
			{#if setting.kind === 'switch'}
				<div class="flex items-center justify-between gap-4">
					<div class="flex min-w-0 flex-col gap-1">
						<Label for={controlId}>{setting.label}</Label>
						<p class="text-(--text-muted) text-caption">
							{setting.description}
						</p>
					</div>
					<Switch
						id={controlId}
						checked={field.state.value === true}
						onCheckedChange={(checked) => field.handleChange(checked)}
					/>
				</div>
			{:else}
				<AdminSettingRow
					label={setting.label}
					caption={fieldCaption(setting)}
					error={fieldError}
					for={controlId}
					stacked={isStacked(setting)}
				>
					{#if setting.kind === 'choice'}
						<ChipDropdown
							id={controlId}
							fullWidth
							align="start"
							aria-label={setting.label}
							options={setting.options}
							bind:value={
								() => String(field.state.value),
								(value) => field.handleChange(value ?? '')
							}
						/>
					{:else if setting.kind === 'list'}
						<ChipTextarea
							id={controlId}
							name={field.name}
							rows={LIST_ROWS}
							resizable
							placeholder={setting.placeholder}
							value={String(field.state.value)}
							onblur={field.handleBlur}
							oninput={(event) => field.handleChange(event.currentTarget.value)}
							error={Boolean(fieldError)}
						/>
					{:else}
						<ChipInput
							id={controlId}
							name={field.name}
							inputmode={setting.kind === 'quantity' ? 'numeric' : undefined}
							placeholder={setting.kind === 'text'
								? setting.placeholder
								: undefined}
							value={String(field.state.value)}
							onblur={field.handleBlur}
							oninput={(event) => field.handleChange(event.currentTarget.value)}
							error={Boolean(fieldError)}
						/>
					{/if}
				</AdminSettingRow>
			{/if}
		{/snippet}
	</form.Field>
{/snippet}

<SettingsPage
	title="Settings"
	description={settingsDescription(settings)}
	{actions}
	{dirty}
	onDiscard={() => form.reset(initialValues)}
>
	<form
		id={formId}
		novalidate
		class="flex flex-col gap-7"
		onsubmit={formSubmitHandler(form)}
	>
		{#each sections as section (section.title)}
			<SettingsSectionView title={section.title} description={section.note}>
				<div class="flex flex-col gap-5">
					{#each section.fields as setting (setting.name)}
						{@render settingControl(setting)}
					{/each}
				</div>
			</SettingsSectionView>
		{/each}
	</form>
	<PlatformRegistriesSection />
	<OperationsSection {settings} />
</SettingsPage>
