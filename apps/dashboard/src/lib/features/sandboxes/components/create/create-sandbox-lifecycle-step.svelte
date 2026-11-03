<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->
<script lang="ts" module>
import {
	MAXIMUM_EGRESS_BANDWIDTH_BPS,
	MINIMUM_EGRESS_BANDWIDTH_BPS,
} from '#lib/features/sandboxes/lib/sandbox-network-policy.ts';
import { formatCount } from '#lib/utils/format.ts';

const MINIMUM_RETENTION_MINUTES = 1;
const EGRESS_BANDWIDTH_HINT = `Between ${formatCount(MINIMUM_EGRESS_BANDWIDTH_BPS)} and ${formatCount(MAXIMUM_EGRESS_BANDWIDTH_BPS)}. Empty uses the organization default.`;
</script>

<script lang="ts">
import { SandboxMode } from '@snapflow/api-client';
import {
	AUTO_ARCHIVE_OPTIONS,
	AUTO_DELETE_OPTIONS,
	AUTO_STOP_OPTIONS,
	MODE_OPTIONS,
} from '#lib/features/sandboxes/lib/create/create-sandbox-options.ts';
import type { CreateSandboxForm } from '#lib/features/sandboxes/state/create-sandbox-wizard.svelte.ts';

interface CreateSandboxLifecycleStepProps {
	form: CreateSandboxForm;
	gpu: boolean;
	mode: SandboxMode;
}

let { form, gpu, mode }: CreateSandboxLifecycleStepProps = $props();
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
	<form.AppField name="autoStopInterval">
		{#snippet children(
			field
		)}
			<field.DurationField
				label="Stop after inactivity"
				options={AUTO_STOP_OPTIONS}
				hint="Stopped sandboxes are not charged for compute."
			/>
		{/snippet}
	</form.AppField>
	<form.AppField name="autoArchiveInterval">
		{#snippet children(
			field
		)}
			<field.DurationField
				label="Archive after stopping"
				options={AUTO_ARCHIVE_OPTIONS}
				minimum={MINIMUM_RETENTION_MINUTES}
				hint="Frees runtime resources. Longest retention is set by your deployment."
			/>
		{/snippet}
	</form.AppField>
</div>
<form.AppField name="mode">
	{#snippet children(
		field
	)}
		<field.SelectField label="Type" options={MODE_OPTIONS} disabled={gpu} />
	{/snippet}
</form.AppField>
{#if mode === SandboxMode.Standard}
	<form.AppField name="autoDeleteInterval">
		{#snippet children(
			field
		)}
			<field.DurationField
				label="Delete after stopping"
				options={AUTO_DELETE_OPTIONS}
				minimum={MINIMUM_RETENTION_MINUTES}
				hint="Deletion is permanent."
			/>
		{/snippet}
	</form.AppField>
{:else}
	<p class="-mt-1.75 px-2 text-(--text-muted) text-caption">
		Temporary sandboxes are permanently deleted when they stop.
	</p>
{/if}
<form.AppField name="networkBlockAll">
	{#snippet children(
		field
	)}
		<field.SwitchField
			label="Block outbound internet"
			description="Prevents all outbound connections."
		/>
	{/snippet}
</form.AppField>
<form.AppField name="networkAllowList">
	{#snippet children(
		field
	)}
		<field.TextField
			label="CIDR allow list"
			placeholder="8.8.8.0/24, 1.1.1.1/32"
			hint="Comma-separated public IPv4 networks."
		/>
	{/snippet}
</form.AppField>
<form.AppField name="domainAllowList">
	{#snippet children(
		field
	)}
		<field.TextField
			label="Domain allow list"
			placeholder="registry.npmjs.org, github.com"
			hint="Comma-separated exact domain names."
		/>
	{/snippet}
</form.AppField>
<form.AppField name="egressBandwidthBps">
	{#snippet children(
		field
	)}
		<field.TextField
			label="Egress bandwidth (bits per second)"
			inputmode="numeric"
			hint={EGRESS_BANDWIDTH_HINT}
		/>
	{/snippet}
</form.AppField>
