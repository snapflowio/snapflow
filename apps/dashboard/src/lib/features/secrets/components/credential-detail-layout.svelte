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

interface CredentialDetailLayoutProps {
	back: PageBack;
	actions?: readonly HeaderAction[];
	title?: string;
	dirty?: boolean;
	onDiscard?: () => void;
	children: Snippet;
}
</script>

<script lang="ts">
import PageHeaderBar from '#lib/components/page/page-header-bar.svelte';
import UnsavedChangesGuard from '#lib/components/settings/unsaved-changes-guard.svelte';
import {
	PAGE_COLUMN_CLASS,
	PAGE_SCROLL_CLASS,
} from '#lib/components/ui/chip/chip-chrome.ts';

let {
	back,
	actions,
	title,
	dirty = false,
	onDiscard,
	children,
}: CredentialDetailLayoutProps = $props();
</script>

<div class="flex h-full min-h-0 flex-col bg-bg">
	<PageHeaderBar {back} {actions} />
	<div class={PAGE_SCROLL_CLASS}>
		<div class={PAGE_COLUMN_CLASS}>
			{#if title}
				<h1 class="text-(--text-body) text-lg">{title}</h1>
			{/if}
			{@render children()}
		</div>
	</div>
</div>
<UnsavedChangesGuard {dirty} {onDiscard} />
