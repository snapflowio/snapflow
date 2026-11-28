<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { Snippet } from 'svelte';
import InfoTooltip from '#lib/components/page/info-tooltip.svelte';

interface PageSectionProps {
	title: string;
	description?: string;
	info?: string;
	actions?: Snippet;
	children: Snippet;
}

let { title, description, info, actions, children }: PageSectionProps =
	$props();

const titleId = $props.id();
</script>

<section aria-labelledby={titleId} class="relative flex flex-col gap-4">
	<div class="flex flex-row items-start justify-between gap-4">
		<div class="flex w-full min-w-0 flex-col gap-y-2">
			<div class="flex items-center gap-x-2">
				<h2 id={titleId} class="heading-xxs">
					{title}
				</h2>
				{#if info}
					<InfoTooltip content={info} />
				{/if}
			</div>
			{#if description}
				<p class="text-pretty text-(--text-muted) text-sm leading-snug">
					{description}
				</p>
			{/if}
		</div>
		{#if actions}
			<div class="flex shrink-0 items-center gap-2">{@render actions()}</div>
		{/if}
	</div>
	{@render children()}
</section>
