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

export function defaultsFromSettings(
	settings: OrganizationSettings
): OrganizationDefaultsValues {
	return {
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
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import SettingsToggleRow from '#lib/components/settings/settings-toggle-row.svelte';

let { canManage, onSave, saving, settings }: OrganizationDefaultsFormProps =
	$props();

const initial = $derived(defaultsFromSettings(settings));
let values = $derived(initial);

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
	<div class="flex flex-col gap-4">
		<SettingsToggleRow
			label="Limited network egress"
			caption="New sandboxes start with limited outbound network access."
			bind:checked={
				() => values.sandboxLimitedNetworkEgress,
				(sandboxLimitedNetworkEgress) => update({ sandboxLimitedNetworkEgress })
			}
			disabled={!canManage || saving}
		/>
	</div>
</SettingsSection>

<SettingsSection title="Privacy">
	<SettingsToggleRow
		label="Telemetry"
		caption="Share anonymous product usage data to help improve Snapflow."
		bind:checked={
			() => values.telemetryEnabled,
			(telemetryEnabled) => update({ telemetryEnabled })
		}
		disabled={!canManage || saving}
	/>
</SettingsSection>
