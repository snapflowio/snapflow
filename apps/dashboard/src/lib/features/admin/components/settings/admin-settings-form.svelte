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
import type { SettingsRowLayout } from '#lib/components/settings/settings-row.svelte';
import type {
	SettingField,
	SettingsSection,
} from '#lib/features/admin/lib/settings/setting-fields.ts';
import { settingUnitPreview } from '#lib/features/admin/lib/settings/setting-units.ts';
import {
	EDGE_INGRESS_SECTION,
	FUNDING_SECTION,
	MACHINE_POLICY_SECTION,
	MARKETPLACE_SECTION,
	PRICING_SECTION,
	QUOTA_SECTION,
	RELAY_FEE_SECTION,
	SETTLEMENT_SECTION,
	TRAFFIC_SECTION,
	VERIFICATION_SECTION,
} from '#lib/features/admin/lib/settings/settings-sections.ts';
import {
	AdminSettingsTab,
	adminSettingsSearchSchema,
	adminSettingsTabs,
} from '#lib/features/admin/lib/settings/settings-tabs.ts';
import { sandboxClassLabel } from '#lib/features/sandboxes/lib/sandbox-state.ts';
import { formatDateTime } from '#lib/utils/format.ts';

const SANDBOX_CLASS_OPTIONS = Object.values(SandboxClass).map(
	(sandboxClass) => ({
		label: sandboxClassLabel(sandboxClass),
		value: sandboxClass,
	})
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
			info: 'New accounts start with restricted outbound bandwidth for their sandboxes.',
		},
	],
};

const TAB_SECTIONS: Record<AdminSettingsTab, readonly SettingsSection[]> = {
	[AdminSettingsTab.General]: [
		DEFAULTS_SECTION,
		QUOTA_SECTION,
		PRICING_SECTION,
		FUNDING_SECTION,
	],
	[AdminSettingsTab.Marketplace]: [
		MARKETPLACE_SECTION,
		VERIFICATION_SECTION,
		SETTLEMENT_SECTION,
		RELAY_FEE_SECTION,
	],
	[AdminSettingsTab.Network]: [TRAFFIC_SECTION, EDGE_INGRESS_SECTION],
	[AdminSettingsTab.Machines]: [MACHINE_POLICY_SECTION],
	[AdminSettingsTab.Operations]: [],
};

function settingsDescription(settings: Settings): string {
	const updated = `Version ${settings.resourceVersion} · Updated ${formatDateTime(settings.updatedAt)}`;
	return settings.updatedBy ? `${updated} by ${settings.updatedBy}` : updated;
}

function fieldCaption(field: SettingField): string | undefined {
	switch (field.kind) {
		case 'quantity':
			return field.hint;
		case 'list':
			return field.hint ?? 'One per line';
		case 'text':
			return field.hint;
		case 'switch':
			return field.info;
		default:
			return undefined;
	}
}

function rowLayout(field: SettingField): SettingsRowLayout {
	if (field.kind === 'switch') return 'inline';
	return field.kind === 'list' || field.kind === 'text' ? 'stacked' : 'split';
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
import ResourceTabs from '#lib/components/resource/resource-tabs.svelte';
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import SettingsRow from '#lib/components/settings/settings-row.svelte';
import SettingsSectionView from '#lib/components/settings/settings-section.svelte';
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipInputSuffix from '#lib/components/ui/chip/chip-input-suffix.svelte';
import ChipTextarea from '#lib/components/ui/chip/chip-textarea.svelte';
import Switch from '#lib/components/ui/switch.svelte';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import {
	changedSettings,
	settingFormValues,
} from '#lib/features/admin/lib/settings/setting-fields.ts';
import { settingFormSchema } from '#lib/features/admin/lib/settings/settings-validators.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
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
const params = new SearchParams(adminSettingsSearchSchema);
const tab = $derived(params.current.tab);
const tabs = $derived(adminSettingsTabs(tab));
const tabSections = $derived(TAB_SECTIONS[tab]);
const fields = Object.values(TAB_SECTIONS).flatMap((sections) =>
	sections.flatMap((section) => section.fields)
);
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
		onDiscard: () => form.reset(initialValues),
		form: formId,
	})
);
</script>

{#snippet settingControl(setting: SettingField)}
	<form.Field name={setting.name}>
		{#snippet children(field)}
			{const controlId = $derived(`${formId}-${setting.name}`)}
			{const fieldError = $derived(firstFieldError(field.state.meta.errors))}
			<SettingsRow
				layout={rowLayout(setting)}
				label={setting.label}
				description={fieldCaption(setting)}
				error={fieldError}
				for={controlId}
			>
				{#if setting.kind === 'switch'}
					<Switch
						id={controlId}
						checked={field.state.value === true}
						onCheckedChange={(checked) => field.handleChange(checked)}
					/>
				{:else if setting.kind === 'choice'}
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
				{:else if setting.kind === 'quantity'}
					{const preview = $derived(
						settingUnitPreview(setting.unit, String(field.state.value))
					)}
					{#snippet unitSuffix()}
						<ChipInputSuffix>{setting.unit.label}</ChipInputSuffix>
					{/snippet}
					<div class="flex w-full flex-col gap-1.5">
						<ChipInput
							id={controlId}
							name={field.name}
							inputmode="numeric"
							value={String(field.state.value)}
							onblur={field.handleBlur}
							oninput={(event) => field.handleChange(event.currentTarget.value)}
							error={Boolean(fieldError)}
							endAdornment={unitSuffix}
						/>
						{#if preview}
							<p class="text-(--text-muted) text-xs">{preview}</p>
						{/if}
					</div>
				{:else}
					<ChipInput
						id={controlId}
						name={field.name}
						placeholder={setting.placeholder}
						value={String(field.state.value)}
						onblur={field.handleBlur}
						oninput={(event) => field.handleChange(event.currentTarget.value)}
						error={Boolean(fieldError)}
					/>
				{/if}
			</SettingsRow>
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
	<ResourceTabs {tabs} label="Settings views" />
	{#if tabSections.length > 0}
		<form
			id={formId}
			novalidate
			class="flex flex-col gap-8"
			onsubmit={formSubmitHandler(form)}
		>
			{#each tabSections as section (section.title)}
				<SettingsSectionView title={section.title} description={section.note}>
					{#each section.fields as setting (setting.name)}
						{@render settingControl(setting)}
					{/each}
				</SettingsSectionView>
			{/each}
		</form>
	{/if}
	{#if tab === AdminSettingsTab.Machines}
		<PlatformRegistriesSection />
	{:else if tab === AdminSettingsTab.Operations}
		<OperationsSection {settings} />
	{/if}
</SettingsPage>
