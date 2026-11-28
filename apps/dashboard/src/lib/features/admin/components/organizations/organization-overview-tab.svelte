<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const UNTIL_UNSUSPENDED = 'Until unsuspended';
const NO_REASON = 'No reason recorded';
</script>

<script lang="ts">
import type { AdminOrganization } from '@snapflow/api-client';
import { createQuery } from '@tanstack/svelte-query';
import { adminOrganizationQuotasQueryOptions } from '#lib/api/admin/organizations.ts';
import DetailSection from '#lib/components/detail/detail-section.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import PageColumn from '#lib/components/page/page-column.svelte';
import QueryFeedbackState from '#lib/components/query-feedback-state.svelte';
import ResourceDetailShell from '#lib/components/resource/resource-detail-shell.svelte';
import { EMPTY_CELL_PLACEHOLDER } from '#lib/components/resource/table/resource-table.ts';
import Notice from '#lib/components/ui/notice.svelte';
import AdminDetailList from '#lib/features/admin/components/shared/admin-detail-list.svelte';
import { adminLoadErrorMessage } from '#lib/features/admin/lib/admin-load-error.ts';
import type { OrganizationDetailChrome } from '#lib/features/admin/lib/organization-detail-tabs.ts';
import { quotaSummary } from '#lib/features/admin/lib/quota-fields.ts';
import { sandboxClassLabel } from '#lib/features/sandboxes/lib/sandbox-state.ts';
import { formatOptionalDateTime } from '#lib/utils/format.ts';
import { pluralize } from '#lib/utils/text.ts';

interface OrganizationOverviewTabProps {
	chrome: OrganizationDetailChrome;
	organization: AdminOrganization;
}

let { chrome, organization }: OrganizationOverviewTabProps = $props();

const quotasQuery = createQuery(() =>
	adminOrganizationQuotasQueryOptions(organization.id)
);
</script>

<ResourceDetailShell {...chrome}>
	<PageColumn class="gap-y-12">
		{#if organization.suspended}
			<Notice
				tone="error"
				title={`Suspended: ${organization.suspensionReason ?? NO_REASON}`}
			/>
			<DetailSection title="Suspension">
				<AdminDetailList label="Suspension">
					<KeyValueRow
						label="Since"
						value={formatOptionalDateTime(
							organization.suspendedAt,
							EMPTY_CELL_PLACEHOLDER
						)}
						align="end"
					/>
					<KeyValueRow
						label="Ends"
						value={formatOptionalDateTime(
							organization.suspendedUntil,
							UNTIL_UNSUSPENDED
						)}
						align="end"
					/>
					<KeyValueRow
						label="Cleanup after"
						value={pluralize(
							organization.suspensionCleanupGracePeriodHours,
							'hour'
						)}
						align="end"
					/>
				</AdminDetailList>
			</DetailSection>
		{/if}
		<DetailSection title="Quotas">
			{#if quotasQuery.isSuccess}
				{#if quotasQuery.data.length > 0}
					<AdminDetailList label="Quotas">
						{#each quotasQuery.data as quota (quota.sandboxClass)}
							<KeyValueRow
								label={sandboxClassLabel(quota.sandboxClass)}
								value={quotaSummary(quota)}
								align="end"
							/>
						{/each}
					</AdminDetailList>
				{:else}
					<p class="text-(--text-muted) text-sm">No quota set.</p>
				{/if}
			{:else}
				<QueryFeedbackState
					errorMessage={adminLoadErrorMessage(quotasQuery.error, 'quotas')}
					loadingMessage="Loading quotas"
					query={quotasQuery}
				/>
			{/if}
		</DetailSection>
	</PageColumn>
</ResourceDetailShell>
