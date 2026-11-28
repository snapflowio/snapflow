<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { ClassValue } from 'svelte/elements';
import { DISPLAY_LOCALE } from '#lib/utils/format.ts';

export interface TimestampProps {
	value: string | Date;
	class?: ClassValue;
}

const REFRESH_INTERVAL_MS = 60_000;
const MILLISECONDS_PER_SECOND = 1000;
const PREVIEW_OPEN_DELAY_MS = 300;
const PREVIEW_SIDE_OFFSET = 6;

const UTC_FORMAT = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
	year: 'numeric',
	month: 'short',
	day: 'numeric',
	hour: 'numeric',
	minute: '2-digit',
	second: '2-digit',
	timeZone: 'UTC',
	timeZoneName: 'short',
});
</script>

<script lang="ts">
import { LinkPreview } from 'bits-ui';
import { useInterval } from 'runed';
import { formatRelativeTime } from '#lib/components/resource/table/time-cell.ts';
import {
	POPOVER_ANIMATION_CLASS,
	POPOVER_SURFACE_CLASS,
} from '#lib/components/ui/chip/chip-chrome.ts';
import { CopyToClipboard } from '#lib/components/ui/clipboard/copy-to-clipboard.svelte.ts';
import { formatDateTime } from '#lib/utils/format.ts';
import { cn } from '#lib/utils/utils.ts';

let { value, class: className }: TimestampProps = $props();

let now = $state(new Date());
useInterval(REFRESH_INTERVAL_MS, {
	callback: () => {
		now = new Date();
	},
});
const clipboard = new CopyToClipboard();
let copiedRow = $state<string | null>(null);

const date = $derived(value instanceof Date ? value : new Date(value));
const label = $derived(formatRelativeTime(date, now));
const rows = $derived([
	{ id: 'local', label: 'Local', text: formatDateTime(date) },
	{ id: 'utc', label: 'UTC', text: UTC_FORMAT.format(date) },
	{
		id: 'unix',
		label: 'Unix',
		text: String(Math.floor(date.getTime() / MILLISECONDS_PER_SECOND)),
	},
]);

async function copyRow(id: string, text: string): Promise<void> {
	if (await clipboard.copy(text)) copiedRow = id;
}
</script>

<LinkPreview.Root openDelay={PREVIEW_OPEN_DELAY_MS}>
	<LinkPreview.Trigger>
		{#snippet child({ props })}
			<button
				{...props}
				type="button"
				class={cn(
					'cursor-default whitespace-nowrap rounded-xs text-(--text-muted) text-sm tabular-nums outline-none focus-visible:focus-ring',
					className
				)}
			>
				<time datetime={date.toISOString()}>{label}</time>
			</button>
		{/snippet}
	</LinkPreview.Trigger>
	<LinkPreview.Portal>
		<LinkPreview.Content
			sideOffset={PREVIEW_SIDE_OFFSET}
			class={cn(
				POPOVER_ANIMATION_CLASS,
				POPOVER_SURFACE_CLASS,
				'z-(--z-tooltip) flex min-w-56 flex-col p-1'
			)}
		>
			{#each rows as row (row.id)}
				<button
					type="button"
					class="flex h-7 cursor-pointer items-center justify-between gap-4 rounded-md px-2 text-left text-[13px] outline-none hover-hover:bg-surface-5 focus-visible:bg-surface-5"
					onclick={() => void copyRow(row.id, row.text)}
				>
					<span class="text-(--text-subtle)">{row.label}</span>
					<span class="font-mono text-(--text-primary) text-xs tabular-nums">
						{clipboard.copied && copiedRow === row.id ? 'Copied' : row.text}
					</span>
				</button>
			{/each}
		</LinkPreview.Content>
	</LinkPreview.Portal>
</LinkPreview.Root>
