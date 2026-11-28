<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { Portal } from 'bits-ui';
import { prefersReducedMotion } from 'svelte/motion';
import { onNavigate } from '$app/navigation';
import ToastItem from './toast-item.svelte';
import { TOAST_WIDTH, VIEWPORT_INSET_PX } from './toast-stack.ts';
import { toasts } from './toasts.svelte.ts';

onNavigate(({ from, to }) => {
	if (from?.url.pathname !== to?.url.pathname) toasts.leaveRoute();
});

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
	<ol
		aria-live="polite"
		aria-label="Notifications"
		data-native-surface-overlay=""
		data-toast-viewport=""
		onmouseenter={() => (toasts.expanded = true)}
		onmouseleave={() => (toasts.expanded = false)}
		onfocuscapture={() => (toasts.expanded = true)}
		onblurcapture={collapseOnBlur}
		class={[
			'fixed z-(--z-toast) m-0 list-none p-0',
			toasts.items.length === 0 && 'pointer-events-none',
		]}
		style:right={`${VIEWPORT_INSET_PX}px`}
		style:bottom={`max(${VIEWPORT_INSET_PX}px, env(safe-area-inset-bottom))`}
		style:width={TOAST_WIDTH}
		style:height={`${toasts.stack.containerHeight}px`}
	>
		{#each toasts.stack.layout as entry (entry.toast.id)}
			<ToastItem
				toast={entry.toast}
				geometry={entry.geometry}
				reduceMotion={prefersReducedMotion.current}
				onDismiss={toasts.dismiss}
				onMeasure={toasts.measure}
			/>
		{/each}
	</ol>
</Portal>
