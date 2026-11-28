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

export type ResourceDetailsPanelWidth = 'record' | 'wide';

const PANEL_WIDTH = {
	record: 400,
	wide: 520,
	MIN: 320,
	MAX_VIEWPORT_RATIO: 0.45,
} as const;
const PANEL_WIDTH_STORAGE_KEY = 'snapflow-details-panel-width';
const PREVIOUS_KEYS = ['up'] as const;
const NEXT_KEYS = ['down'] as const;
const PANEL_EDGE_OFFSET = 8;

interface ResourceDetailsPanelProps {
	open: boolean;
	title: string;
	resourceId?: string;
	resourceIdLabel?: string;
	width?: ResourceDetailsPanelWidth;
	onClose: () => void;
	onPrevious?: () => void;
	onNext?: () => void;
	actions?: Snippet;
	children: Snippet;
}

function maximumWidth(viewportWidth: number): number {
	return Math.max(
		PANEL_WIDTH.MIN,
		viewportWidth * PANEL_WIDTH.MAX_VIEWPORT_RATIO
	);
}

function clampWidth(width: number): number {
	return Math.min(
		Math.max(width, PANEL_WIDTH.MIN),
		maximumWidth(window.innerWidth)
	);
}
</script>

<script lang="ts">
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import ChevronUp from '@lucide/svelte/icons/chevron-up';
import X from '@lucide/svelte/icons/x';
import { PersistedState } from 'runed';
import { untrack } from 'svelte';
import { innerWidth } from 'svelte/reactivity/window';
import CopyIdChip from '#lib/components/page/copy-id-chip.svelte';
import { useDashboardAside } from '#lib/components/page/page-aside.svelte.ts';
import IconButton from '#lib/components/ui/icon-button.svelte';
import ResizeHandle from '#lib/components/ui/resize-handle/resize-handle.svelte';
import { isEditableTarget } from '#lib/utils/keyboard.ts';
import { numberSerializer } from '#lib/utils/storage-serializers.ts';

let {
	open,
	title,
	resourceId,
	resourceIdLabel,
	width: widthPreset = 'record',
	onClose,
	onPrevious,
	onNext,
	actions,
	children,
}: ResourceDetailsPanelProps = $props();

const preset = untrack(() => widthPreset);
const storedWidth = new PersistedState(
	`${PANEL_WIDTH_STORAGE_KEY}:${preset}`,
	PANEL_WIDTH[preset],
	{ serializer: numberSerializer(PANEL_WIDTH[preset]), syncTabs: false }
);
const width = $derived(clampWidth(storedWidth.current));

useDashboardAside(() =>
	open ? { label: title, variant: 'panel', width, content: panel } : null
);

function handleKeydown(event: KeyboardEvent): void {
	if (!open || event.defaultPrevented || isEditableTarget(event.target)) {
		return;
	}
	if (event.key === 'Escape') {
		onClose();
	} else if (event.key === 'ArrowUp' && onPrevious) {
		event.preventDefault();
		onPrevious();
	} else if (event.key === 'ArrowDown' && onNext) {
		event.preventDefault();
		onNext();
	}
}

function setWidth(next: number): void {
	storedWidth.current = clampWidth(next);
}
</script>

<svelte:window onkeydown={handleKeydown} />

{#snippet panel()}
	<ResizeHandle
		label="Resize details panel"
		edge="left"
		class="z-10 max-lg:hidden"
		value={width}
		min={PANEL_WIDTH.MIN}
		max={maximumWidth(innerWidth.current ?? PANEL_WIDTH.MIN)}
		widthAt={(clientX) =>
			clampWidth(window.innerWidth - PANEL_EDGE_OFFSET - clientX)}
		onResize={setWidth}
	/>
	<div class="flex shrink-0 items-center justify-between gap-2 py-3 pr-3 pl-4">
		<div class="flex min-w-0 items-center gap-2">
			<h2 class="min-w-0 truncate text-(--text-primary) text-base">{title}</h2>
			{#if resourceId}
				<CopyIdChip value={resourceId} label={resourceIdLabel} />
			{/if}
		</div>
		<div class="flex shrink-0 items-center gap-1">
			{#if actions}
				<div
					class="flex items-center gap-1 [&_[data-icon-button]]:size-8 [&_[data-icon-button]_svg]:size-4"
				>
					{@render actions()}
				</div>
			{/if}
			{#if onPrevious}
				<IconButton
					size="md"
					label="Previous"
					shortcut={PREVIOUS_KEYS}
					icon={ChevronUp}
					onclick={onPrevious}
				/>
			{/if}
			{#if onNext}
				<IconButton
					size="md"
					label="Next"
					shortcut={NEXT_KEYS}
					icon={ChevronDown}
					onclick={onNext}
				/>
			{/if}
			<IconButton
				size="md"
				label="Close"
				shortcut="esc"
				icon={X}
				onclick={onClose}
			/>
		</div>
	</div>
	<div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
		{@render children()}
	</div>
{/snippet}
