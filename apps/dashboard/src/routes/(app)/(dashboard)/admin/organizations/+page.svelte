<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Resource from '#lib/components/resource/resource.svelte';
import OrganizationsView from '#lib/features/admin/components/organizations/organizations-view.svelte';
import QuotaRequestsView from '#lib/features/admin/components/organizations/quota-requests-view.svelte';
import { ORGANIZATION_VIEWS } from '#lib/features/admin/lib/admin-views.ts';
import { AdminViewParam } from '#lib/features/admin/state/admin-view-param.svelte.ts';

const views = new AdminViewParam(ORGANIZATION_VIEWS);
</script>

<svelte:head>
	<title>Organizations · Snapflow</title>
</svelte:head>

<Resource>
	{#key views.current}
		{#if views.current === 'limit-requests'}
			<QuotaRequestsView title="Organizations" viewSwitch={views.switch} />
		{:else}
			<OrganizationsView title="Organizations" viewSwitch={views.switch} />
		{/if}
	{/key}
</Resource>
