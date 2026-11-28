<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import DetailColumn from '#lib/components/detail/detail-column.svelte';
import DetailItem from '#lib/components/detail/detail-item.svelte';
import DetailSection from '#lib/components/detail/detail-section.svelte';
import LogViewer from '#lib/components/log-viewer/log-viewer.svelte';
import PageColumn from '#lib/components/page/page-column.svelte';
import StatusLabel from '#lib/components/ui/status/status-label.svelte';
import {
	releaseDetails,
	releaseSummary,
	updateFailureLines,
} from '#lib/features/machines/lib/machine-software.ts';
import { getMachineDetail } from '#lib/features/machines/state/machine-detail.svelte.ts';

const UPDATE_LOG_FILENAME = 'snapflow-update.txt';
const NOT_REPORTED = 'Not reported yet';

const detail = getMachineDetail();
const machine = $derived(detail.machine);
const services = $derived(machine.serviceHealth ?? []);
const failureLines = $derived(updateFailureLines(machine.updateStatus));
</script>

<PageColumn class="gap-y-12">
	<DetailSection title="Release">
		<DetailColumn>
			<DetailItem
				label="Snapflow"
				info={machine.updateStatus
					? releaseDetails(machine.updateStatus)
					: undefined}
				value={releaseSummary(machine)}
			/>
			<DetailItem label="API version" value={machine.apiVersion} />
		</DetailColumn>
	</DetailSection>
	<DetailSection title="Services" separated>
		<DetailColumn>
			{#each services as service (service.serviceName)}
				<DetailItem label={service.serviceName}>
					<StatusLabel
						label={service.healthy ? 'Healthy' : 'Unhealthy'}
						shape={service.healthy ? 'check' : 'cross'}
						tone={service.healthy ? 'success' : 'error'}
						description={service.errorReason}
					/>
				</DetailItem>
			{:else}
				<DetailItem label="Services" value={NOT_REPORTED} />
			{/each}
		</DetailColumn>
	</DetailSection>
	{#if failureLines.length > 0}
		<DetailSection title="Last update" separated>
			<LogViewer
				lines={failureLines}
				filename={UPDATE_LOG_FILENAME}
				class="h-60"
			/>
		</DetailSection>
	{/if}
</PageColumn>
