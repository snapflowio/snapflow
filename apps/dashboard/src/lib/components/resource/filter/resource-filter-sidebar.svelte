<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const FILTER_SIDEBAR_TITLE = 'Filters';
</script>

<script lang="ts">
import X from '@lucide/svelte/icons/x';
import type { Snippet } from 'svelte';
import ResourcePanelHeader from '#lib/components/resource/resource-panel-header.svelte';
import IconButton from '#lib/components/ui/icon-button.svelte';
import ScrollArea from '#lib/components/ui/scroll-area.svelte';
import type { ResourceFilterSidebar } from './resource-filter-sidebar.svelte.ts';

interface ResourceFilterSidebarProps {
	children: Snippet;
	id: string;
	sidebar: ResourceFilterSidebar;
}

let { children, id, sidebar }: ResourceFilterSidebarProps = $props();

const titleId = $props.id();

function closeOnEscape(event: KeyboardEvent) {
	if (sidebar.overlay && sidebar.open && event.key === 'Escape') {
		sidebar.close();
	}
}
</script>

<svelte:window onkeydown={closeOnEscape} />

{#snippet closeAction()}
	<IconButton label="Close filters" icon={X} onclick={sidebar.close} />
{/snippet}

{#if sidebar.open}
	{#if sidebar.overlay}
		<button
			type="button"
			aria-label="Close filters"
			class="absolute inset-0 z-(--z-dropdown) bg-black/10"
			onclick={sidebar.close}
		></button>
	{/if}
	<aside
		{id}
		aria-labelledby={titleId}
		class={[
			'flex w-80 max-w-full shrink-0 flex-col border-border border-l bg-bg',
			sidebar.overlay &&
				'absolute inset-y-0 right-0 z-(--z-dropdown) shadow-overlay',
		]}
	>
		<ResourcePanelHeader
			id={titleId}
			title={FILTER_SIDEBAR_TITLE}
			actions={closeAction}
		/>
		<ScrollArea
			aria-label={FILTER_SIDEBAR_TITLE}
			axis="vertical"
			class="flex-1"
		>
			{@render children()}
		</ScrollArea>
	</aside>
{/if}
