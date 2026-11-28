<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ServerIcon from '@lucide/svelte/icons/server';
import type { Snippet } from 'svelte';
import SectionError from '#lib/components/app/section-error.svelte';
import ResourceChromeFallback from '#lib/components/resource/resource-chrome-fallback.svelte';
import ResourceDetailShell from '#lib/components/resource/resource-detail-shell.svelte';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import MachineDetailDialogs from '#lib/features/machines/components/detail/machine-detail-dialogs.svelte';
import { machineDetailTabs } from '#lib/features/machines/lib/machine-detail-tabs.ts';
import {
	MachineDetail,
	setMachineDetail,
} from '#lib/features/machines/state/machine-detail.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';
import { page } from '$app/state';

interface MachineDetailLayoutProps {
	machineId: string;
	children: Snippet;
}

let { machineId, children }: MachineDetailLayoutProps = $props();

const MACHINES_HREF = resolve(Path.MACHINES);
const MACHINES_CRUMB = {
	label: 'Machines',
	href: MACHINES_HREF,
	icon: ServerIcon,
};

const detail = setMachineDetail(new MachineDetail(() => machineId));
const tabs = $derived(
	machineDetailTabs(machineId, {
		routeId: page.route.id,
		complaints: detail.complaintCount,
		showsListing: detail.canReadListings,
	})
);
</script>

{#snippet menu()}
	<ResourceRowActions
		reveal="header"
		label="Machine actions"
		actions={detail.menuActions}
	/>
{/snippet}

{#if detail.query.isPending}
	<ResourceChromeFallback breadcrumbs={[MACHINES_CRUMB]} {tabs} />
{:else if detail.query.isError || !detail.query.data}
	<SectionError
		title="Couldn't load this machine"
		details={detail.query.error?.message}
		backHref={MACHINES_HREF}
		backLabel="Back to machines"
		retrying={detail.query.isFetching}
		onRetry={() => void detail.query.refetch()}
	/>
{:else}
	{const machine = $derived(detail.query.data)}
	<ResourceDetailShell
		breadcrumbs={[MACHINES_CRUMB, { label: machine.name }]}
		actions={detail.headerActions}
		trailing={menu}
		canWrite={detail.canWrite}
		pending={detail.query.isFetching}
		{tabs}
	>
		{#snippet status()}
			<ResourceStateBadge
				variant="pill"
				state={machine.state}
				errorReason={machine.readinessReason}
			/>
		{/snippet}
		{@render children()}
	</ResourceDetailShell>
	<MachineDetailDialogs />
{/if}
