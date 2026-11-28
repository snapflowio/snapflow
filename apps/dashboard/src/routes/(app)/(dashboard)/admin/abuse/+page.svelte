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
import AbuseCasesView from '#lib/features/admin/components/abuse/abuse-cases-view.svelte';
import AbuseReportsView from '#lib/features/admin/components/abuse/abuse-reports-view.svelte';
import { ABUSE_VIEWS } from '#lib/features/admin/lib/admin-views.ts';
import { AdminViewParam } from '#lib/features/admin/state/admin-view-param.svelte.ts';

const views = new AdminViewParam(ABUSE_VIEWS);
</script>

<svelte:head>
	<title>Abuse · Snapflow</title>
</svelte:head>

<Resource>
	{#key views.current}
		{#if views.current === 'cases'}
			<AbuseCasesView title="Abuse" viewSwitch={views.switch} />
		{:else}
			<AbuseReportsView title="Abuse" viewSwitch={views.switch} />
		{/if}
	{/key}
</Resource>
