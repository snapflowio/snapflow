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

export const PANEL_CODE_CLASS =
	'overflow-auto rounded-lg bg-surface-3 p-3 font-mono text-(--text-secondary) text-xs leading-5';

interface PanelSectionProps {
	title?: string;
	info?: string;
	action?: Snippet;
	children: Snippet;
}
</script>

<script lang="ts">
import InfoTooltip from '#lib/components/page/info-tooltip.svelte';

let { title, info, action, children }: PanelSectionProps = $props();

const titleId = $props.id();
</script>

<section
	aria-labelledby={title ? titleId : undefined}
	class="-mx-4 flex min-w-0 flex-col gap-3 border-border border-t px-4 py-3"
>
	{#if title || action}
		<div class="flex min-h-6 min-w-0 items-center gap-2">
			{#if title}
				<h3 id={titleId} class="font-medium text-(--text-primary) text-sm">
					{title}
				</h3>
			{/if}
			{#if info}
				<InfoTooltip content={info} />
			{/if}
			{#if action}
				<div class="ml-auto flex shrink-0 items-center gap-2">
					{@render action()}
				</div>
			{/if}
		</div>
	{/if}
	{@render children()}
</section>
