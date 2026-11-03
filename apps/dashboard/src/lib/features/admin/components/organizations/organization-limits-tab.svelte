<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { createQuery } from '@tanstack/svelte-query';
import { adminOrganizationLimitsQueryOptions } from '#lib/api/admin/organizations.ts';
import ResourceDetailShell from '#lib/components/resource/resource-detail-shell.svelte';
import AdminQueryFeedback from '#lib/features/admin/components/admin-query-feedback.svelte';
import type { OrganizationDetailChrome } from '#lib/features/admin/lib/organization-detail-tabs.ts';
import OrganizationLimitsEditor from './organization-limits-editor.svelte';

interface OrganizationLimitsTabProps {
	chrome: OrganizationDetailChrome;
	organizationId: string;
}

let { chrome, organizationId }: OrganizationLimitsTabProps = $props();

const limitsQuery = createQuery(() =>
	adminOrganizationLimitsQueryOptions(organizationId)
);
</script>

{#if limitsQuery.data}
	<OrganizationLimitsEditor
		{chrome}
		{organizationId}
		limits={limitsQuery.data}
	/>
{:else}
	<ResourceDetailShell {...chrome}>
		<AdminQueryFeedback
			errorMessage="Failed to load organization limits"
			loadingMessage="Loading organization limits..."
			query={limitsQuery}
		/>
	</ResourceDetailShell>
{/if}
