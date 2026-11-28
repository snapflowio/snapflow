<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const EXIT_SCALE = 0.95;
const MESSAGE_CLAMP_LINES = 2;
const MESSAGE_LINE_HEIGHT_PX = 20;
const DESCRIPTION_CLAMP_LINES = 3;
const DESCRIPTION_LINE_HEIGHT_PX = 20;
const REQUEST_ID_PREFIX = 'Request ID';
const REQUEST_ID_COPIED = 'Request ID copied';
</script>

<script lang="ts">
import Check from '@lucide/svelte/icons/check';
import Copy from '@lucide/svelte/icons/copy';
import X from '@lucide/svelte/icons/x';
import { animate } from 'motion';
import { useResizeObserver } from 'runed';
import Chip from '#lib/components/ui/chip/chip.svelte';
import { CopyToClipboard } from '#lib/components/ui/clipboard/copy-to-clipboard.svelte.ts';
import IconButton from '#lib/components/ui/icon-button.svelte';
import { EASE_ENTER, EASE_EXIT } from '#lib/components/ui/motion.ts';
import { goto } from '$app/navigation';
import type { ToastAction, ToastData } from './toast-model.ts';
import {
	EXIT_DURATION,
	INSTANT,
	motionOut,
	stackDuration,
} from './toast-motion.ts';
import ToastRevealText from './toast-reveal-text.svelte';
import {
	CARD_BORDER_PX,
	cardRadiusPx,
	TOAST_WIDTH,
	type ToastGeometry,
} from './toast-stack.ts';
import { VARIANT_ALERT_ROLE, VARIANT_ICON } from './toast-variants.ts';

interface ToastItemProps {
	toast: ToastData;
	geometry: ToastGeometry;
	reduceMotion: boolean;
	onDismiss: (id: string) => void;
	onMeasure: (id: string, height: number) => void;
}

let {
	toast: t,
	geometry,
	reduceMotion,
	onDismiss,
	onMeasure,
}: ToastItemProps = $props();

let hovered = $state(false);
let entered = false;
const clipboard = new CopyToClipboard();
const Icon = $derived(VARIANT_ICON[t.variant]);
const cornerRadius = $derived(cardRadiusPx(geometry.height));
const stackTransition = $derived(
	reduceMotion
		? INSTANT
		: { duration: stackDuration(), ease: EASE_ENTER, height: INSTANT }
);

function dismiss(): void {
	onDismiss(t.id);
}

function runAction(selected: ToastAction): void {
	if ('to' in selected) void goto(selected.to);
	else selected.onClick();
	dismiss();
}

function measureContent(content: HTMLDivElement): void {
	const id = t.id;
	const report = () => onMeasure(id, content.offsetHeight + CARD_BORDER_PX);
	report();
	useResizeObserver(() => content, report);
}

function followStack(node: HTMLLIElement): void {
	const { y, scale, height } = geometry;
	const keyframes =
		entered || reduceMotion
			? { opacity: 1, y, scale, height }
			: { opacity: [0, 1], y: [height, y], scale, height };
	entered = true;
	animate(node, keyframes, stackTransition);
}

function exitToast(node: Element) {
	return motionOut(
		node,
		{ opacity: 0, scale: EXIT_SCALE },
		reduceMotion ? INSTANT : { duration: EXIT_DURATION, ease: EASE_EXIT }
	);
}
</script>

<li
	{@attach followStack}
	out:exitToast
	onmouseenter={() => (hovered = true)}
	onmouseleave={() => (hovered = false)}
	style:z-index={geometry.zIndex}
	style:transform-origin="bottom"
	style:width={TOAST_WIDTH}
	style:border-radius={`${cornerRadius}px`}
	class="group pointer-events-auto absolute right-0 bottom-0 m-0 overflow-hidden border border-border bg-surface-1 shadow-(--shadow-overlay)"
>
	<div
		{@attach measureContent}
		role={VARIANT_ALERT_ROLE[t.variant]}
		class="flex flex-col gap-1 py-4 pr-10 pl-5"
	>
		<div class="flex items-start gap-2">
			<div class="min-w-0 flex-1">
				<ToastRevealText
					text={t.message}
					expanded={hovered}
					clampLines={MESSAGE_CLAMP_LINES}
					lineHeightPx={MESSAGE_LINE_HEIGHT_PX}
					class="font-medium text-(--text-primary) text-sm leading-5"
					{reduceMotion}
				>
					{#snippet leadingIcon()}
						<span class="mr-1.5 inline-flex h-5 items-center align-top">
							<Icon class="size-4 shrink-0 text-(--text-muted)" />
						</span>
					{/snippet}
				</ToastRevealText>
			</div>
			<div
				class="absolute top-2 right-2 opacity-0 transition-opacity duration-(--motion-quick) focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
			>
				<IconButton label="Dismiss notification" icon={X} onclick={dismiss} />
			</div>
		</div>
		{#if t.description}
			<ToastRevealText
				text={t.description}
				expanded={hovered}
				clampLines={DESCRIPTION_CLAMP_LINES}
				lineHeightPx={DESCRIPTION_LINE_HEIGHT_PX}
				class="text-(--text-body)/80 text-sm leading-5"
				{reduceMotion}
			/>
		{/if}
		{#if t.requestId}
			{const requestId = $derived(t.requestId)}
			<button
				type="button"
				aria-label={clipboard.label(`Copy request ID ${requestId}`)}
				class="flex min-w-0 cursor-pointer items-center gap-1.5 self-start rounded-xs font-mono text-(--text-subtle) text-xs outline-none transition-colors duration-(--motion-quick) hover-hover:text-(--text-secondary) focus-visible:focus-ring"
				onclick={() => void clipboard.copy(requestId)}
			>
				<span class="truncate">
					{clipboard.copied
						? REQUEST_ID_COPIED
						: `${REQUEST_ID_PREFIX} ${requestId}`}
				</span>
				{#if clipboard.copied}
					<Check class="size-3 shrink-0" />
				{:else}
					<Copy class="size-3 shrink-0" />
				{/if}
			</button>
		{/if}
		{#if t.action}
			{const action = $derived(t.action)}
			<Chip
				variant="secondary"
				size="compact"
				onclick={() => runAction(action)}
				class="mt-2 self-start"
			>
				{action.label}
			</Chip>
		{/if}
	</div>
</li>
