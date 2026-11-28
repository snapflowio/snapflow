<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import History from '@lucide/svelte/icons/history';
import type { AbuseCaseActionRecord } from '@snapflow/api-client';
import DetailSection from '#lib/components/detail/detail-section.svelte';
import EmptyState from '#lib/components/empty-state.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import AdminDetailList from '#lib/features/admin/components/shared/admin-detail-list.svelte';
import { ABUSE_CASE_ACTION_LABEL } from '#lib/features/admin/lib/abuse-reports-list.ts';

interface AbuseReportHistoryProps {
	actions: readonly AbuseCaseActionRecord[];
}

let { actions }: AbuseReportHistoryProps = $props();
</script>

{#if actions.length === 0}
	<EmptyState icon={History} title="No actions taken yet" />
{:else}
	<DetailSection title="Actions">
		<AdminDetailList label="Actions">
			{#each actions as record (`${record.action}-${record.createdAt}`)}
				<KeyValueRow
					label={ABUSE_CASE_ACTION_LABEL[record.action]}
					info={record.note ?? undefined}
					align="end"
				>
					<Timestamp value={record.createdAt} />
				</KeyValueRow>
			{/each}
		</AdminDetailList>
	</DetailSection>
{/if}
