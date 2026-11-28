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

type TextContent = string | Snippet;

const SETTINGS_GROUP_CLASS =
	'flex min-w-0 flex-col gap-3 has-[>[data-settings-row]]:gap-0 has-[>[data-settings-row]]:divide-y has-[>[data-settings-row]]:divide-border has-[>[data-settings-row]]:overflow-hidden has-[>[data-settings-row]]:rounded-2xl has-[>[data-settings-row]]:border has-[>[data-settings-row]]:border-border [&>[data-settings-row]]:px-6 [&>[data-settings-row]]:py-4';
</script>

<script lang="ts">
import type { ClassValue } from 'svelte/elements';
import InfoTooltip from '#lib/components/page/info-tooltip.svelte';
import { cn } from '#lib/utils/utils.ts';

interface SettingsSectionProps {
	title?: TextContent;
	description?: string;
	info?: TextContent;
	accessory?: Snippet;
	action?: Snippet;
	children: Snippet;
	class?: ClassValue;
}

let {
	title,
	description,
	info,
	accessory,
	action,
	children,
	class: className,
}: SettingsSectionProps = $props();

const titleId = $props.id();
const hasHeading = $derived(Boolean(title || action || accessory));
</script>

{#snippet text(content: TextContent)}
	{#if typeof content === 'string'}
		{content}
	{:else}
		{@render content()}
	{/if}
{/snippet}

<section
	aria-labelledby={title ? titleId : undefined}
	class={cn('flex w-full flex-col gap-3', className)}
>
	{#if hasHeading || description}
		<div class="flex min-w-0 flex-col gap-1">
			<div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2">
				{#if title}
					<h2 id={titleId} class="heading-xxs">
						{@render text(title)}
					</h2>
				{/if}
				{#if info}
					<InfoTooltip content={info} />
				{/if}
				{@render accessory?.()}
				{#if action}
					<div class="ml-auto flex shrink-0 items-center gap-2">
						{@render action()}
					</div>
				{/if}
			</div>
			{#if description}
				<p class="text-pretty text-(--text-muted) text-sm">{description}</p>
			{/if}
		</div>
	{/if}
	<div data-settings-group="" class={SETTINGS_GROUP_CLASS}>
		{@render children()}
	</div>
</section>
