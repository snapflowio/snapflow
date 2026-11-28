<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const TRIGGER_CLASS =
	"relative inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-sm text-(--text-icon) outline-none transition-colors duration-(--motion-quick) before:absolute before:-inset-1 before:content-[''] hover-hover:text-(--text-primary) focus-visible:focus-ring";
const LEARN_MORE_LABEL = 'Learn more';
</script>

<script lang="ts">
import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
import Info from '@lucide/svelte/icons/info';
import type { Snippet } from 'svelte';
import Popover from '#lib/components/ui/popover/popover.svelte';
import PopoverContent from '#lib/components/ui/popover/popover-content.svelte';
import PopoverTrigger from '#lib/components/ui/popover/popover-trigger.svelte';
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';

interface InfoTooltipProps {
	content: string | Snippet;
	label?: string;
	href?: string;
	hrefLabel?: string;
}

let {
	content,
	label = 'More information',
	href,
	hrefLabel = LEARN_MORE_LABEL,
}: InfoTooltipProps = $props();

const external = $derived(href !== undefined && /^[a-z]+:/i.test(href));
</script>

{#snippet body()}
	{#if typeof content === 'string'}
		{content}
	{:else}
		{@render content()}
	{/if}
{/snippet}

{#if href}
	<Popover>
		<PopoverTrigger type="button" aria-label={label} class={TRIGGER_CLASS}>
			<Info class="size-3.5" />
		</PopoverTrigger>
		<PopoverContent
			class="w-fit max-w-[min(16rem,calc(100vw-2rem))] px-3 py-1.5 text-(--text-body) text-sm"
		>
			<p>{@render body()}</p>
			<a
				{href}
				target={external ? '_blank' : undefined}
				rel={external ? 'noopener noreferrer' : undefined}
				class="mt-1.5 inline-flex items-center gap-1 text-(--text-primary) underline underline-offset-4"
			>
				{hrefLabel}
				<ArrowUpRight class="size-3" />
			</a>
		</PopoverContent>
	</Popover>
{:else}
	<Tooltip {content}>
		{#snippet child({ props })}
			<button {...props} type="button" aria-label={label} class={TRIGGER_CLASS}>
				<Info class="size-3.5" />
			</button>
		{/snippet}
	</Tooltip>
{/if}
