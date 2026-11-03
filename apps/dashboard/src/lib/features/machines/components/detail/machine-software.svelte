<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import FeedbackState from '#lib/components/feedback-state.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import PageColumn from '#lib/components/page/page-column.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import MachineDetailRow from '#lib/features/machines/components/detail/machine-detail-row.svelte';
import { MACHINE_SERVICE_STATE } from '#lib/features/machines/lib/machine-format.ts';
import { getMachineDetail } from '#lib/features/machines/state/machine-detail.svelte.ts';

const machineDetail = getMachineDetail();
const machine = $derived(machineDetail.machine);
const services = $derived(machine.serviceHealth ?? []);
</script>

<PageColumn>
	{#if machine.updateStatus?.lastFailure}
		{const failure = $derived(machine.updateStatus.lastFailure)}
		<Notice tone="error">
			{#snippet title()}
				The last update failed
			{/snippet}
			{#snippet description()}
				{failure}
			{/snippet}
		</Notice>
	{/if}
	<SettingsSection title="Release">
		<KeyValueList>
			<MachineDetailRow
				label="Version"
				value={machine.appVersion ?? 'Unknown'}
			/>
			{#if machine.updateStatus}
				{const updateStatus = $derived(machine.updateStatus)}
				<MachineDetailRow label="Channel" value={updateStatus.channel} />
				<MachineDetailRow label="Update phase" value={updateStatus.phase} />
				<MachineDetailRow
					label="Maintenance window"
					value={updateStatus.maintenanceWindow}
				/>
				{#if updateStatus.candidate}
					<MachineDetailRow
						label="Staged version"
						value={updateStatus.candidate.version}
					/>
				{/if}
				{#if updateStatus.previous}
					<MachineDetailRow
						label="Previous version"
						value={updateStatus.previous.version}
					/>
				{/if}
			{/if}
		</KeyValueList>
	</SettingsSection>
	<SettingsSection title="Services">
		{#if services.length > 0}
			<KeyValueList>
				{#each services as service (service.serviceName)}
					<KeyValueRow>
						{#snippet label()}
							{service.serviceName}
						{/snippet}
						{#snippet value()}
							<ResourceStateBadge
								errorReason={service.errorReason}
								state={service.healthy
									? MACHINE_SERVICE_STATE.healthy
									: MACHINE_SERVICE_STATE.unhealthy}
							/>
						{/snippet}
					</KeyValueRow>
				{/each}
			</KeyValueList>
		{:else}
			<FeedbackState
				class="min-h-0 py-4"
				message="Services appear here once the machine reports its health."
			/>
		{/if}
	</SettingsSection>
</PageColumn>
