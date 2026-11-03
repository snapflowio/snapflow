<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ShieldCheck from '@lucide/svelte/icons/shield-check';
import type { AuditLog } from '@snapflow/api-client';
import Badge from '#lib/components/ui/badge.svelte';
import {
	auditActorLabel,
	auditStatusVariant,
	auditUnknownLabel,
} from '#lib/features/audit/lib/audit-event.ts';
import { formatDateTime } from '#lib/utils/format.ts';

interface AuditEventDetailsProps {
	auditEvent: AuditLog;
}

let { auditEvent }: AuditEventDetailsProps = $props();

const rows = $derived(
	[
		{ label: 'Actor', value: auditActorLabel(auditEvent) },
		{ label: 'Actor type', value: auditUnknownLabel(auditEvent.actorType) },
		{ label: 'Actor ID', value: auditEvent.actorId },
		{
			label: 'Credential',
			value: auditUnknownLabel(auditEvent.credentialType),
		},
		{ label: 'Credential ID', value: auditEvent.credentialId },
		{ label: 'Target', value: auditEvent.targetType },
		{ label: 'Target ID', value: auditEvent.targetId },
		{ label: 'Source', value: auditEvent.source },
		{ label: 'IP address', value: auditEvent.ipAddress },
		{ label: 'User agent', value: auditEvent.userAgent },
	].filter((row): row is { label: string; value: string } => Boolean(row.value))
);
const metadata = $derived(
	auditEvent.metadata && Object.keys(auditEvent.metadata).length > 0
		? JSON.stringify(auditEvent.metadata, null, 2)
		: null
);
</script>

<div class="flex flex-col gap-2.5 pb-4">
	<div class="grid grid-cols-2 gap-x-3 pb-0.5">
		<div class="flex min-w-0 flex-col gap-0.5">
			<span class="text-(--text-tertiary) text-caption">Timestamp</span>
			<span class="text-(--text-secondary) text-sm tabular-nums">
				{formatDateTime(auditEvent.createdAt)}
			</span>
		</div>
		<div class="flex min-w-0 flex-col gap-0.5">
			<span class="text-(--text-tertiary) text-caption">Action</span>
			<div class="flex min-w-0 items-center gap-1.5">
				<ShieldCheck class="size-3.5 shrink-0 text-(--text-icon)" />
				<span class="min-w-0 truncate text-(--text-secondary) text-sm">
					{auditEvent.action}
				</span>
			</div>
		</div>
	</div>

	<div
		class="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface-2"
	>
		{#if auditEvent.statusCode}
			<div class="flex h-10 items-center gap-2 px-3">
				<span class="shrink-0 text-(--text-tertiary) text-caption">Status</span>
				<div class="flex w-0 flex-1 justify-end">
					<Badge size="sm" variant={auditStatusVariant(auditEvent.statusCode)}>
						{auditEvent.statusCode}
					</Badge>
				</div>
			</div>
		{/if}
		{#each rows as row (row.label)}
			<div class="flex h-10 min-w-0 items-center justify-between gap-4 px-3">
				<span class="shrink-0 text-(--text-tertiary) text-caption">
					{row.label}
				</span>
				<span
					class="min-w-0 truncate text-(--text-secondary) text-caption"
					title={row.value}
				>
					{row.value}
				</span>
			</div>
		{/each}
	</div>

	{#if auditEvent.errorMessage}
		<div
			class="flex flex-col gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-2"
		>
			<span class="text-(--text-tertiary) text-caption">Error</span>
			<p class="wrap-break-word text-(--text-error) text-small">
				{auditEvent.errorMessage}
			</p>
		</div>
	{/if}

	{#if metadata}
		<div
			class="flex flex-col gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-2"
		>
			<span class="text-(--text-tertiary) text-caption">Metadata</span>
			<pre
				class="max-h-75 overflow-auto whitespace-pre-wrap break-all font-mono text-(--text-secondary) text-caption"
			>{metadata}</pre>
		</div>
	{/if}
</div>
