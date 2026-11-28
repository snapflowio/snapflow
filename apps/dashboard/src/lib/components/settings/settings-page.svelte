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
import PageColumn from '#lib/components/page/page-column.svelte';
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

<PageColumn
	width="settings"
	{title}
	info={description}
	{back}
	{actions}
	{trailing}
>
	{#if search}
		<ChipInput
			icon={Search}
			value={search.value}
			oninput={(event) => search.onChange(event.currentTarget.value)}
			placeholder={search.placeholder ?? 'Search...'}
			aria-label={search.placeholder ?? 'Search'}
			class="md:max-w-64"
		/>
	{/if}
	{@render children()}
</PageColumn>
<UnsavedChangesGuard {dirty} {onDiscard} />
