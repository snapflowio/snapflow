<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const FADE_LINE_COUNT = 1.5;
const REVEAL_EASE_X1 = 0.2;
const REVEAL_EASE_Y1 = 0;
const REVEAL_EASE_X2 = 0;
const REVEAL_EASE_Y2 = 1;
const REVEAL_EASE = [
	REVEAL_EASE_X1,
	REVEAL_EASE_Y1,
	REVEAL_EASE_X2,
	REVEAL_EASE_Y2,
] as const;
const REVEAL_BLUR = 'blur(5px)';
const NO_BLUR = 'blur(0px)';
const TRUNCATION_TOLERANCE_PX = 1;
</script>

<script lang="ts">
import { animate } from 'motion';
import { useResizeObserver } from 'runed';
import type { Snippet } from 'svelte';
import type { ClassValue } from 'svelte/elements';
import {
	INSTANT,
	motionOut,
	RESIZE_DURATION,
	TOAST_EASE,
} from './toast-motion.ts';

interface ToastRevealTextProps {
	text: string;
	expanded: boolean;
	clampLines: number;
	lineHeightPx: number;
	leadingIcon?: Snippet;
	class?: ClassValue;
	reduceMotion: boolean;
}

let {
	text,
	expanded,
	clampLines,
	lineHeightPx,
	leadingIcon,
	class: className,
	reduceMotion,
}: ToastRevealTextProps = $props();

let truncated = $state(false);
const clampHeight = $derived(clampLines * lineHeightPx);
const open = $derived(expanded && truncated);
const fadeStart = $derived(
	Math.max(0, clampHeight - lineHeightPx * FADE_LINE_COUNT)
);
const mask = $derived(
	truncated && !open
		? `linear-gradient(to bottom, #000 ${fadeStart}px, transparent ${clampHeight}px)`
		: undefined
);
const resizeTransition = $derived(
	reduceMotion ? INSTANT : { duration: RESIZE_DURATION, ease: TOAST_EASE }
);
const revealTransition = $derived(
	reduceMotion ? INSTANT : { duration: RESIZE_DURATION, ease: REVEAL_EASE }
);

function measureTruncation(head: HTMLDivElement): void {
	const current = text;
	const check = () => {
		if (!head.textContent?.includes(current)) return;
		truncated = head.scrollHeight - head.clientHeight > TRUNCATION_TOLERANCE_PX;
	};
	check();
	useResizeObserver(() => head, check);
}

function expandHeight(node: HTMLDivElement): void {
	animate(node, { height: [0, 'auto'] }, resizeTransition);
}

function revealText(node: HTMLDivElement): void {
	animate(
		node,
		{ opacity: [0, 1], filter: [REVEAL_BLUR, NO_BLUR] },
		revealTransition
	);
}

function collapseHeight(node: Element) {
	return motionOut(node, { height: 0 }, resizeTransition);
}
</script>

<div>
	<div
		{@attach measureTruncation}
		class={['overflow-hidden', className]}
		style:max-height={`${clampHeight}px`}
		style:mask-image={mask}
		style:-webkit-mask-image={mask}
	>
		{@render leadingIcon?.()}{text}
	</div>
	{#if open}
		<div
			class="overflow-hidden"
			aria-hidden="true"
			{@attach expandHeight}
			out:collapseHeight
		>
			<div
				class={className}
				style:margin-top={`${-clampHeight}px`}
				{@attach revealText}
			>
				{@render leadingIcon?.()}{text}
			</div>
		</div>
	{/if}
</div>
