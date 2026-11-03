<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { Snippet } from 'svelte';
import type { HeaderAction } from './header-actions.ts';

export type PageBack =
	| { label: string; href: string; onSelect?: undefined }
	| { label: string; onSelect: () => void; href?: undefined };

export interface PageHeaderBarProps {
	back?: PageBack;
	leading?: Snippet;
	actions?: readonly HeaderAction[];
	trailing?: Snippet;
	bordered?: boolean;
}
</script>

<script lang="ts">
import ArrowLeft from '@lucide/svelte/icons/arrow-left';
import Chip from '#lib/components/ui/chip/chip.svelte';
import {
	PAGE_HEADER_BAR_CLASS,
	RESOURCE_HEADER_BAR_CLASS,
} from '#lib/components/ui/chip/chip-chrome.ts';
import HeaderActionCluster from './header-action-cluster.svelte';

let {
	back,
	leading,
	actions,
	trailing,
	bordered = false,
}: PageHeaderBarProps = $props();
</script>

<header
	class={[
		bordered ? RESOURCE_HEADER_BAR_CLASS : PAGE_HEADER_BAR_CLASS,
		'justify-between gap-x-3',
	]}
>
	<div class="flex min-w-0 flex-1 items-center gap-1">
		{#if back?.href !== undefined}
			<Chip href={back.href} leftIcon={ArrowLeft}>{back.label}</Chip>
		{:else if back}
			<Chip leftIcon={ArrowLeft} onclick={back.onSelect}>{back.label}</Chip>
		{/if}
		{@render leading?.()}
	</div>
	<HeaderActionCluster {actions} leading={trailing} class="ml-auto" />
</header>
