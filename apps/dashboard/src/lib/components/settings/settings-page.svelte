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
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import type { PageBack } from '#lib/components/page/page-header-bar.svelte';

export interface SettingsSearch {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
}

interface SettingsPageProps {
	title: string;
	description?: string;
	back?: PageBack;
	actions?: readonly HeaderAction[];
	trailing?: Snippet;
	search?: SettingsSearch;
	dirty?: boolean;
	onDiscard?: () => void;
	children: Snippet;
}
</script>

<script lang="ts">
import Search from '@lucide/svelte/icons/search';
import PageHeaderBar from '#lib/components/page/page-header-bar.svelte';
import {
	PAGE_COLUMN_CLASS,
	PAGE_SCROLL_CLASS,
} from '#lib/components/ui/chip/chip-chrome.ts';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import UnsavedChangesGuard from './unsaved-changes-guard.svelte';

let {
	title,
	description,
	back,
	actions,
	trailing,
	search,
	dirty = false,
	onDiscard,
	children,
}: SettingsPageProps = $props();
</script>

<div class="flex h-full min-h-0 flex-col bg-bg">
	<PageHeaderBar {back} {actions} {trailing} />
	<div class={PAGE_SCROLL_CLASS}>
		<div class={PAGE_COLUMN_CLASS}>
			<div class="flex flex-col gap-1">
				<h1 class="text-(--text-body) text-lg">{title}</h1>
				{#if description}
					<p class="text-(--text-muted) text-md">{description}</p>
				{/if}
			</div>
			{#if search}
				<ChipInput
					icon={Search}
					value={search.value}
					oninput={(event) => search.onChange(event.currentTarget.value)}
					placeholder={search.placeholder ?? 'Search...'}
					aria-label={search.placeholder ?? 'Search'}
				/>
			{/if}
			{@render children()}
		</div>
	</div>
</div>
<UnsavedChangesGuard {dirty} {onDiscard} />
