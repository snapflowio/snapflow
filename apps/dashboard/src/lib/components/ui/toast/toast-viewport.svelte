<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const STACK_EXIT_DURATION = 0.2;
</script>

<script lang="ts">
import { Portal } from 'bits-ui';
import { MediaQuery } from 'svelte/reactivity';
import { onNavigate } from '$app/navigation';
import ToastItem from './toast-item.svelte';
import { INSTANT, motionOut } from './toast-motion.ts';
import { TOAST_WIDTH, VIEWPORT_INSET_PX } from './toast-stack.ts';
import { toasts } from './toasts.svelte.ts';

const reducedMotion = new MediaQuery('prefers-reduced-motion: reduce');

onNavigate(({ from, to }) => {
	if (from?.url.pathname !== to?.url.pathname) toasts.leaveRoute();
});

function fadeStack(node: Element) {
	return motionOut(
		node,
		{ opacity: 0 },
		reducedMotion.current
			? INSTANT
			: { duration: STACK_EXIT_DURATION, ease: 'easeIn' }
	);
}

function collapseOnBlur(
	event: FocusEvent & { currentTarget: EventTarget & HTMLOListElement }
): void {
	const next = event.relatedTarget;
	if (!(next instanceof Node && event.currentTarget.contains(next))) {
		toasts.expanded = false;
	}
}
</script>

<Portal>
	{#if toasts.items.length > 0}
		<ol
			out:fadeStack
			aria-live="polite"
			aria-label="Notifications"
			data-native-surface-overlay=""
			data-toast-viewport=""
			onmouseenter={() => (toasts.expanded = true)}
			onmouseleave={() => (toasts.expanded = false)}
			onfocuscapture={() => (toasts.expanded = true)}
			onblurcapture={collapseOnBlur}
			class="fixed z-(--z-toast) m-0 list-none p-0"
			style:right={`${VIEWPORT_INSET_PX}px`}
			style:bottom={`${VIEWPORT_INSET_PX}px`}
			style:width={TOAST_WIDTH}
			style:height={`${toasts.stack.containerHeight}px`}
		>
			{#each toasts.stack.layout as entry (entry.toast.id)}
				<ToastItem
					toast={entry.toast}
					geometry={entry.geometry}
					reduceMotion={reducedMotion.current}
					onDismiss={toasts.dismiss}
					onMeasure={toasts.measure}
				/>
			{/each}
		</ol>
	{/if}
</Portal>
