<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { DrainingMode } from '@snapflow/api-client';

const DRAINING_MODE_LABELS: Record<DrainingMode, string> = {
	[DrainingMode.Migrate]: 'Migrate',
	[DrainingMode.Archive]: 'Archive',
};
</script>

<script lang="ts">
import type { SetDrainingPolicy, Settings } from '@snapflow/api-client';
import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import {
	setDrainingPolicyMutationOptions,
	setMaintenanceModeMutationOptions,
} from '#lib/api/admin/platform-settings.ts';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import Label from '#lib/components/ui/label.svelte';
import Switch from '#lib/components/ui/switch.svelte';
import AdminSettingRow from '#lib/features/admin/components/admin-setting-row.svelte';
import DrainingPolicyModal from './draining-policy-modal.svelte';

interface OperationsSectionProps {
	settings: Settings;
}

let { settings }: OperationsSectionProps = $props();

const maintenanceId = $props.id();
const queryClient = useQueryClient();
const maintenance = createMutation(() =>
	setMaintenanceModeMutationOptions(queryClient)
);
const draining = createMutation(() =>
	setDrainingPolicyMutationOptions(queryClient)
);
let confirmingMaintenance = $state(false);
let editingDraining = $state(false);
const enabling = $derived(!settings.maintenanceMode);
const drainingPolicy: SetDrainingPolicy = $derived({
	mode: settings.drainingMode,
	force: settings.drainingForce,
});
const drainingCaption = $derived(
	`${DRAINING_MODE_LABELS[settings.drainingMode]}${settings.drainingForce ? ', forced' : ''}. How draining machines move their sandboxes.`
);

function toggleMaintenance() {
	maintenance.mutate(
		{ body: { enabled: enabling } },
		{
			onSuccess: () => {
				confirmingMaintenance = false;
			},
		}
	);
}
</script>

<SettingsSection
	title="Operations"
	description="Applies immediately and is not versioned with the settings above."
>
	<div class="flex flex-col gap-5">
		<div class="flex items-center justify-between gap-4">
			<div class="flex min-w-0 flex-col gap-1">
				<Label for={maintenanceId}>Maintenance mode</Label>
				<p class="text-(--text-muted) text-caption">
					While on, the API answers every non-admin request with 503.
				</p>
			</div>
			<Switch
				id={maintenanceId}
				disabled={maintenance.isPending}
				bind:checked={
					() => settings.maintenanceMode,
					() => {
	confirmingMaintenance = true;
}
				}
			/>
		</div>
		<AdminSettingRow label="Machine draining" caption={drainingCaption}>
			<div class="flex justify-end">
				<Chip
					onclick={() => {
						editingDraining = true;
					}}
				>
					Change
				</Chip>
			</div>
		</AdminSettingRow>
	</div>
</SettingsSection>
<ChipModalConfirm
	bind:open={confirmingMaintenance}
	title={enabling ? 'Enable maintenance mode' : 'Disable maintenance mode'}
	text={enabling
		? [
				'Enabling maintenance mode ',
				{
					text: 'answers every non-admin user and SDK client with 503 until it is turned off.',
					error: true,
				},
			]
		: 'Users and SDK clients regain access to the API immediately.'}
	pending={maintenance.isPending}
	onsubmit={toggleMaintenance}
>
	{#snippet confirm()}
		<ChipModalAction
			type="submit"
			variant={enabling ? 'destructive' : 'primary'}
			disabled={maintenance.isPending}
		>
			{#if maintenance.isPending}
				{enabling ? 'Enabling...' : 'Disabling...'}
			{:else}
				{enabling ? 'Enable' : 'Disable'}
			{/if}
		</ChipModalAction>
	{/snippet}
</ChipModalConfirm>
{#if editingDraining}
	<DrainingPolicyModal
		bind:open={editingDraining}
		current={drainingPolicy}
		pending={draining.isPending}
		onSave={(policy) =>
			draining.mutate(
				{ body: policy },
				{
					onSuccess: () => {
						editingDraining = false;
					},
				}
			)}
	/>
{/if}
