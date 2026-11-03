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
import ErrorShell from '#lib/components/app/error-shell.svelte';
import ResourceChromeFallback from '#lib/components/resource/resource-chrome-fallback.svelte';
import ResourceDetailShell from '#lib/components/resource/resource-detail-shell.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import MachineDetailDialogs from '#lib/features/machines/components/detail/machine-detail-dialogs.svelte';
import { machineDetailTabs } from '#lib/features/machines/lib/machine-detail-tabs.ts';
import {
	MachineDetail,
	setMachineDetail,
} from '#lib/features/machines/state/machine-detail.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';
import { page } from '$app/state';
import type { LayoutProps } from './$types';

let { children, params }: LayoutProps = $props();

const MACHINES_HREF = resolve(Path.MACHINES);
const MACHINES_CRUMB = {
	label: 'Machines',
	href: MACHINES_HREF,
	icon: ServerIcon,
};

const detail = setMachineDetail(new MachineDetail(() => params.machineId));
const tabs = $derived(machineDetailTabs(params.machineId, page.route.id));
</script>

{#if detail.query.isPending}
	<ResourceChromeFallback breadcrumbs={[MACHINES_CRUMB]} {tabs} />
{:else if detail.query.isError || !detail.query.data}
	<ErrorShell
		title="Machine unavailable"
		description="This machine could not be loaded."
	>
		<Chip href={MACHINES_HREF}>Go back</Chip>
		<Chip variant="primary" onclick={() => void detail.query.refetch()}>
			Try again
		</Chip>
	</ErrorShell>
{:else}
	{const machine = $derived(detail.query.data)}
	<ResourceDetailShell
		breadcrumbs={[MACHINES_CRUMB, { label: machine.name }]}
		crumbActions={detail.crumbActions}
		actions={detail.headerActions}
		{tabs}
	>
		{#snippet status()}
			<ResourceStateBadge
				state={machine.state}
				errorReason={machine.readinessReason}
			/>
		{/snippet}
		{@render children()}
	</ResourceDetailShell>
	<MachineDetailDialogs />
{/if}
