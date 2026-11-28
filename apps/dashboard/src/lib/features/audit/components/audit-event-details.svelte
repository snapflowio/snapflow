<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const JSON_INDENT = 2;
</script>

<script lang="ts">
import type { AuditLog } from '@snapflow/api-client';
import PanelSection, {
	PANEL_CODE_CLASS,
} from '#lib/components/detail/panel-section.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import CopyCodeButton from '#lib/components/ui/clipboard/copy-code-button.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import { deviceLabel } from '#lib/features/account/lib/user-agent.ts';
import {
	AUDIT_VIA_LABEL,
	auditActorLabel,
	auditFailed,
	auditVia,
} from '#lib/features/audit/lib/audit-event.ts';

interface AuditEventDetailsProps {
	auditEvent: AuditLog;
}

let { auditEvent }: AuditEventDetailsProps = $props();

const metadata = $derived(
	auditEvent.metadata && Object.keys(auditEvent.metadata).length > 0
		? JSON.stringify(auditEvent.metadata, null, JSON_INDENT)
		: null
);
</script>

<div class="flex flex-col pt-1">
	<PanelSection title="Event">
		<KeyValueList framed={false}>
			<KeyValueRow label="Time">
				<Timestamp value={auditEvent.createdAt} />
			</KeyValueRow>
			<KeyValueRow label="Actor" value={auditActorLabel(auditEvent)} />
			{#if auditEvent.actorEmail &&
				auditEvent.actorEmail !== auditActorLabel(auditEvent)}
				<KeyValueRow label="Email" value={auditEvent.actorEmail} />
			{/if}
			<KeyValueRow
				label="Source"
				value={AUDIT_VIA_LABEL[auditVia(auditEvent)]}
			/>
			<KeyValueRow label="Action" value={auditEvent.action} mono />
			{#if auditEvent.statusCode}
				<KeyValueRow label="Status">
					<span
						class={[
							'font-mono text-xs',
							auditFailed(auditEvent) && 'text-(--text-error)',
						]}
					>
						{auditEvent.statusCode}
					</span>
				</KeyValueRow>
			{/if}
		</KeyValueList>
	</PanelSection>
	<PanelSection title="Resource">
		<KeyValueList framed={false}>
			<KeyValueRow label="Type" value={auditEvent.targetType} />
			<KeyValueRow
				label="ID"
				value={auditEvent.targetId}
				copy={auditEvent.targetId}
				copyLabel="Copy target ID"
				mono
			/>
		</KeyValueList>
	</PanelSection>
	<PanelSection title="Request">
		<KeyValueList framed={false}>
			<KeyValueRow
				label="IP address"
				value={auditEvent.ipAddress}
				copy={auditEvent.ipAddress}
				copyLabel="Copy IP address"
				mono
			/>
			<KeyValueRow
				label="Device"
				value={auditEvent.userAgent ? deviceLabel(auditEvent.userAgent) : null}
				info={auditEvent.userAgent}
			/>
		</KeyValueList>
	</PanelSection>
	{#if auditEvent.errorMessage}
		<PanelSection title="Error">
			<p class="wrap-break-word text-(--text-error) text-sm">
				{auditEvent.errorMessage}
			</p>
		</PanelSection>
	{/if}
	{#if metadata}
		<PanelSection title="Details">
			{#snippet action()}
				<CopyCodeButton code={metadata} label="Copy details" />
			{/snippet}
			<pre
				class={[PANEL_CODE_CLASS, 'max-h-75 whitespace-pre-wrap break-all']}
			>{metadata}</pre>
		</PanelSection>
	{/if}
</div>
