<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { OrganizationSettings } from '@snapflow/api-client';
import type { OrganizationDefaultsValues } from '#lib/api/organizations/settings.ts';
import type { ChipOption } from '#lib/components/ui/chip/chip-selection.ts';
import { pluralize } from '#lib/utils/text.ts';

const ARCHIVE_AFTER_STOPPED_DAYS_MAXIMUM = 30;
const READ_ONLY_REASON = 'Needs the Admin or Owner role';

const ARCHIVE_AFTER_OPTIONS: ChipOption<string>[] = Array.from(
	{ length: ARCHIVE_AFTER_STOPPED_DAYS_MAXIMUM + 1 },
	(_, days) => ({
		label: days === 0 ? 'Immediately' : pluralize(days, 'day'),
		value: String(days),
	})
);

export function defaultsFromSettings(
	settings: OrganizationSettings
): OrganizationDefaultsValues {
	return {
		archiveAfterStoppedDays: settings.archiveAfterStoppedDays,
		telemetryEnabled: settings.telemetryEnabled,
		sandboxLimitedNetworkEgress: settings.sandboxLimitedNetworkEgress,
	};
}

interface OrganizationDefaultsFormProps {
	canManage: boolean;
	onSave: (
		values: OrganizationDefaultsValues,
		initial: OrganizationDefaultsValues
	) => Promise<unknown>;
	saving: boolean;
	settings: OrganizationSettings;
}
</script>

<script lang="ts">
import SettingsRow from '#lib/components/settings/settings-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import Switch from '#lib/components/ui/switch.svelte';

let { canManage, onSave, saving, settings }: OrganizationDefaultsFormProps =
	$props();

const initial = $derived(defaultsFromSettings(settings));
let values = $derived(initial);
const disabledReason = $derived(canManage ? undefined : READ_ONLY_REASON);

function update(patch: Partial<OrganizationDefaultsValues>): void {
	const previous = values;
	const next = { ...values, ...patch };
	values = next;
	onSave(next, previous).catch(() => {
		values = previous;
	});
}
</script>

<SettingsSection title="Sandboxes">
	<SettingsRow
		layout="split"
		label="Archive stopped sandboxes after"
		description="Stopped sandboxes move from their machine to Snapflow storage after this long."
		{disabledReason}
	>
		{#snippet control(id)}
			<ChipDropdown
				{id}
				fullWidth
				align="end"
				disabled={!canManage || saving}
				options={ARCHIVE_AFTER_OPTIONS}
				bind:value={
					() => String(values.archiveAfterStoppedDays),
					(days) => {
	if (days !== undefined) update({ archiveAfterStoppedDays: Number(days) });
}
				}
			/>
		{/snippet}
	</SettingsRow>
	<SettingsRow
		label="Limited network egress"
		description="New sandboxes start with limited outbound network access."
		{disabledReason}
	>
		{#snippet control(id)}
			<Switch
				{id}
				bind:checked={
					() => values.sandboxLimitedNetworkEgress,
					(sandboxLimitedNetworkEgress) => update({ sandboxLimitedNetworkEgress })
				}
				disabled={!canManage || saving}
			/>
		{/snippet}
	</SettingsRow>
</SettingsSection>

<SettingsSection title="Privacy">
	<SettingsRow
		label="Telemetry"
		description="Share anonymous product usage data to help improve Snapflow."
		{disabledReason}
	>
		{#snippet control(id)}
			<Switch
				{id}
				bind:checked={
					() => values.telemetryEnabled,
					(telemetryEnabled) => update({ telemetryEnabled })
				}
				disabled={!canManage || saving}
			/>
		{/snippet}
	</SettingsRow>
</SettingsSection>
