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

const PANEL_WIDTH = {
	DEFAULT: 520,
	MIN: 320,
	MAX_VIEWPORT_RATIO: 0.6,
} as const;
const PANEL_WIDTH_STORAGE_KEY = 'snapflow-details-panel-width';

interface ResourceDetailsPanelProps {
	open: boolean;
	title: string;
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
import ArrowDown from '@lucide/svelte/icons/arrow-down';
import ArrowUp from '@lucide/svelte/icons/arrow-up';
import X from '@lucide/svelte/icons/x';
import { PersistedState } from 'runed';
import { innerWidth } from 'svelte/reactivity/window';
import IconButton from '#lib/components/ui/icon-button.svelte';
import ResizeHandle from '#lib/components/ui/resize-handle/resize-handle.svelte';
import { isEditableTarget } from '#lib/utils/keyboard.ts';
import { numberSerializer } from '#lib/utils/storage-serializers.ts';

let {
	open,
	title,
	onClose,
	onPrevious,
	onNext,
	actions,
	children,
}: ResourceDetailsPanelProps = $props();

const storedWidth = new PersistedState(
	PANEL_WIDTH_STORAGE_KEY,
	PANEL_WIDTH.DEFAULT,
	{ serializer: numberSerializer(PANEL_WIDTH.DEFAULT), syncTabs: false }
);
const width = $derived(clampWidth(storedWidth.current));

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

<aside
	aria-label={title}
	inert={!open}
	class={[
		'absolute inset-y-0 right-0 z-(--z-dropdown) flex max-w-full flex-col border-border border-l bg-bg shadow-md transition-transform duration-200 ease-out motion-reduce:transition-none',
		open ? 'translate-x-0' : 'translate-x-full',
	]}
	style:width={`${width}px`}
>
	<ResizeHandle
		label="Resize details panel"
		edge="left"
		class="z-10"
		value={width}
		min={PANEL_WIDTH.MIN}
		max={maximumWidth(innerWidth.current ?? PANEL_WIDTH.MIN)}
		widthAt={(clientX) => clampWidth(window.innerWidth - clientX)}
		onResize={setWidth}
	/>
	<div class="flex h-12 shrink-0 items-center justify-between gap-2 px-4">
		<h2 class="min-w-0 truncate text-(--text-primary) text-sm">{title}</h2>
		<div class="flex shrink-0 items-center gap-0.5">
			{@render actions?.()}
			{#if onPrevious}
				<IconButton
					variant="ghost"
					label="Previous"
					icon={ArrowUp}
					onclick={onPrevious}
				/>
			{/if}
			{#if onNext}
				<IconButton
					variant="ghost"
					label="Next"
					icon={ArrowDown}
					onclick={onNext}
				/>
			{/if}
			<IconButton variant="ghost" label="Close" icon={X} onclick={onClose} />
		</div>
	</div>
	<div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
		{@render children()}
	</div>
</aside>
