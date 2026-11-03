<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const EXIT_DURATION = 0.15;
const EXIT_SCALE = 0.95;
const MESSAGE_CLAMP_LINES = 2;
const MESSAGE_LINE_HEIGHT_PX = 20;
const DESCRIPTION_CLAMP_LINES = 3;
const DESCRIPTION_LINE_HEIGHT_PX = 18;
</script>

<script lang="ts">
import X from '@lucide/svelte/icons/x';
import { animate } from 'motion';
import { useResizeObserver } from 'runed';
import Chip from '#lib/components/ui/chip/chip.svelte';
import {
	chipContentIconClass,
	chipFilledFillTokens,
} from '#lib/components/ui/chip/chip-chrome.ts';
import IconButton from '#lib/components/ui/icon-button.svelte';
import { cn } from '#lib/utils/utils.ts';
import { goto } from '$app/navigation';
import type { ToastAction, ToastData } from './toast-model.ts';
import {
	INSTANT,
	motionOut,
	STACK_DURATION,
	TOAST_EASE,
} from './toast-motion.ts';
import ToastRevealText from './toast-reveal-text.svelte';
import {
	CARD_BORDER_PX,
	cardRadiusPx,
	TOAST_WIDTH,
	type ToastGeometry,
} from './toast-stack.ts';
import { VARIANT_ICON } from './toast-variants.ts';

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
const Icon = $derived(VARIANT_ICON[t.variant]);
const cornerRadius = $derived(cardRadiusPx(geometry.height));
const stackTransition = $derived(
	reduceMotion
		? INSTANT
		: { duration: STACK_DURATION, ease: TOAST_EASE, height: INSTANT }
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
		reduceMotion ? INSTANT : { duration: EXIT_DURATION, ease: 'easeIn' }
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
	class="pointer-events-auto absolute right-0 bottom-0 m-0 overflow-hidden border border-border bg-bg shadow-medium"
>
	<div {@attach measureContent} class="flex flex-col gap-2 p-2">
		<div class="flex items-start gap-2">
			<div class="min-w-0 flex-1">
				<ToastRevealText
					text={t.message}
					expanded={hovered}
					clampLines={MESSAGE_CLAMP_LINES}
					lineHeightPx={MESSAGE_LINE_HEIGHT_PX}
					class="text-(--text-body) text-sm leading-5"
					{reduceMotion}
				>
					{#snippet leadingIcon()}
						<span class="mr-1.5 inline-flex h-5 items-center align-top">
							<Icon class={chipContentIconClass} />
						</span>
					{/snippet}
				</ToastRevealText>
			</div>
			<div class="flex h-5 shrink-0 items-center">
				<IconButton label="Dismiss notification" icon={X} onclick={dismiss} />
			</div>
		</div>
		{#if t.description}
			<ToastRevealText
				text={t.description}
				expanded={hovered}
				clampLines={DESCRIPTION_CLAMP_LINES}
				lineHeightPx={DESCRIPTION_LINE_HEIGHT_PX}
				class="text-(--text-muted) text-small leading-4.5"
				{reduceMotion}
			/>
		{/if}
		{#if t.action}
			{const action = $derived(t.action)}
			<Chip
				fullWidth
				onclick={() => runAction(action)}
				class={cn('justify-center', chipFilledFillTokens)}
			>
				{action.label}
			</Chip>
		{/if}
	</div>
</li>
