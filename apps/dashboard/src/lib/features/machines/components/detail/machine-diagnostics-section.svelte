<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { MachineDiagnosticStatus } from '@snapflow/api-client';
import type {
	StatusRingShape,
	StatusRingTone,
} from '#lib/components/ui/status/status-ring.svelte';

const CHECK_STATUS = {
	[MachineDiagnosticStatus.Ok]: {
		label: 'Passed',
		shape: 'check',
		tone: 'success',
	},
	[MachineDiagnosticStatus.Pending]: {
		label: 'Pending',
		shape: 'half',
		tone: 'neutral',
	},
	[MachineDiagnosticStatus.Failed]: {
		label: 'Failed',
		shape: 'cross',
		tone: 'error',
	},
} as const satisfies Record<
	MachineDiagnosticStatus,
	{ label: string; shape: StatusRingShape; tone: StatusRingTone }
>;

const OPTIONAL_FAILURE = {
	label: 'Failed, optional',
	shape: 'alert',
	tone: 'warning',
} as const;
</script>

<script lang="ts">
import type {
	MachineDiagnosticCheck,
	MachineDiagnostics,
} from '@snapflow/api-client';
import DetailColumn from '#lib/components/detail/detail-column.svelte';
import DetailItem from '#lib/components/detail/detail-item.svelte';
import DetailSection from '#lib/components/detail/detail-section.svelte';
import LogViewer from '#lib/components/log-viewer/log-viewer.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import StatusLabel from '#lib/components/ui/status/status-label.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import {
	diagnosticLogLines,
	sortedDiagnostics,
} from '#lib/features/machines/lib/machine-health.ts';
import DetailDisclosure from './detail-disclosure.svelte';

const DIAGNOSTICS_FILENAME = 'snapflow-doctor.txt';

interface MachineDiagnosticsSectionProps {
	diagnostics: MachineDiagnostics | null;
	separated?: boolean;
}

let { diagnostics, separated = false }: MachineDiagnosticsSectionProps =
	$props();

const checks = $derived(sortedDiagnostics(diagnostics?.checks ?? []));
const lines = $derived(diagnosticLogLines(diagnostics?.checks ?? []));

function checkStatus(check: MachineDiagnosticCheck) {
	if (check.status === MachineDiagnosticStatus.Failed && !check.required) {
		return OPTIONAL_FAILURE;
	}
	return CHECK_STATUS[check.status];
}
</script>

{#snippet log()}
	<LogViewer
		{lines}
		status={diagnostics ? 'ready' : 'waiting'}
		filename={DIAGNOSTICS_FILENAME}
		class="h-64"
	/>
{/snippet}

{#snippet readiness()}
	{#if diagnostics}
		<Timestamp
			value={diagnostics.checkedAt}
			class="text-(--text-subtle) text-sm"
		/>
		<Badge size="sm" variant={diagnostics.ready ? 'success' : 'error'}>
			{diagnostics.ready ? 'Checks passed' : 'Checks failing'}
		</Badge>
	{/if}
{/snippet}

<DetailSection
	title="Diagnostics"
	info="The checks snapflow doctor ran on the machine."
	action={readiness}
	{separated}
>
	{#if checks.length > 0}
		<DetailColumn>
			{#each checks as check (check.name)}
				{const status = $derived(checkStatus(check))}
				<DetailItem label={check.name}>
					<StatusLabel
						label={status.label}
						shape={status.shape}
						tone={status.tone}
						description={check.remediation ?? check.detail}
					/>
				</DetailItem>
			{/each}
		</DetailColumn>
	{/if}
	{#if checks.length > 0}
		<DetailDisclosure showLabel="Show output" hideLabel="Hide output">
			{@render log()}
		</DetailDisclosure>
	{:else}
		{@render log()}
	{/if}
</DetailSection>
