<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { AdminOrganization } from '@snapflow/api-client';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import PageColumn from '#lib/components/page/page-column.svelte';
import ResourceDetailShell from '#lib/components/resource/resource-detail-shell.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import ChipCopyInput from '#lib/components/ui/chip/chip-copy-input.svelte';
import type { OrganizationDetailChrome } from '#lib/features/admin/lib/organization-detail-tabs.ts';
import { formatDateTime } from '#lib/utils/format.ts';
import { formatUsd } from '#lib/utils/usd.ts';

interface OrganizationOverviewTabProps {
	chrome: OrganizationDetailChrome;
	organization: AdminOrganization;
}

let { chrome, organization }: OrganizationOverviewTabProps = $props();
</script>

{#snippet textRow(
	rowLabel: string,
	rowValue: string
)}
	<KeyValueRow>
		{#snippet label()}
			{rowLabel}
		{/snippet}
		{#snippet value()}
			{rowValue}
		{/snippet}
	</KeyValueRow>
{/snippet}

<ResourceDetailShell {...chrome}>
	<PageColumn>
		<SettingsSection title="Organization ID">
			<ChipCopyInput
				value={organization.id}
				copyLabel="Copy organization ID"
				class="font-mono"
			/>
		</SettingsSection>
		<SettingsSection title="Details">
			<KeyValueList>
				{@render textRow('Slug', organization.slug)}
				{@render textRow('Type', organization.personal ? 'Personal' : 'Team')}
				{@render textRow('Members', String(organization.memberCount))}
				{@render textRow(
					'Credit balance',
					formatUsd(organization.creditBalanceMicroUsd)
				)}
				{@render textRow('Created', formatDateTime(organization.createdAt))}
				{#if organization.deletedAt}
					{@render textRow('Deleted', formatDateTime(organization.deletedAt))}
				{/if}
			</KeyValueList>
		</SettingsSection>
		{#if organization.suspended}
			<SettingsSection title="Suspension" tone="danger">
				<KeyValueList>
					{@render textRow('Reason', organization.suspensionReason ?? '—')}
					{@render textRow(
						'Suspended',
						organization.suspendedAt
							? formatDateTime(organization.suspendedAt)
							: '—'
					)}
					{@render textRow(
						'Ends',
						organization.suspendedUntil
							? formatDateTime(organization.suspendedUntil)
							: 'Until unsuspended'
					)}
					{@render textRow(
						'Cleanup grace period',
						`${organization.suspensionCleanupGracePeriodHours} hours`
					)}
				</KeyValueList>
			</SettingsSection>
		{/if}
	</PageColumn>
</ResourceDetailShell>
