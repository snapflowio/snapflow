<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { AbuseAppeal } from '@snapflow/api-client';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import {
	ABUSE_ACTION_LABEL,
	categoriesLabel,
} from '#lib/features/abuse/lib/abuse-appeal.ts';
import { resolve } from '$app/paths';

interface AbuseCaseSummaryProps {
	appeal: AbuseAppeal;
}

let { appeal }: AbuseCaseSummaryProps = $props();
</script>

<KeyValueList>
	<KeyValueRow
		label="Sandbox"
		value={appeal.sandboxId}
		href={resolve('/(app)/(dashboard)/sandboxes/[sandboxId]', {
			sandboxId: appeal.sandboxId,
		})}
		mono
	/>
	<KeyValueRow label="Reported for" value={categoriesLabel(appeal)} />
	{#each appeal.actions as action (`${action.action}-${action.createdAt}`)}
		<KeyValueRow label={ABUSE_ACTION_LABEL[action.action]}>
			<Timestamp value={action.createdAt} />
		</KeyValueRow>
	{/each}
	{#if appeal.resolvedAt}
		{const resolvedAt = $derived(appeal.resolvedAt)}
		<KeyValueRow label="Resolved">
			<Timestamp value={resolvedAt} />
		</KeyValueRow>
	{/if}
</KeyValueList>
