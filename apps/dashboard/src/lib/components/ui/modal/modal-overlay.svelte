<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { Dialog as DialogPrimitive } from 'bits-ui';
import { cn } from '#lib/utils/utils.ts';
import {
	ANIMATION_CLASSES,
	MODAL_ANIMATION_DURATION_CLASS,
} from './modal-animation.ts';
import type { ModalContentState } from './modal-content.svelte.ts';

interface ModalOverlayProps {
	modal: ModalContentState;
}

let { modal }: ModalOverlayProps = $props();
</script>

<DialogPrimitive.Overlay
	class={cn(
		'fixed inset-0 z-(--z-modal) bg-black/10 backdrop-blur-[2px]',
		ANIMATION_CLASSES,
		MODAL_ANIMATION_DURATION_CLASS,
		'data-[state=closed]:pointer-events-none',
		!modal.nativeSurfaceReady && 'data-[state=open]:paused'
	)}
	data-native-surface-overlay=""
	data-native-surface-occlusion="modal"
>
	{#snippet child({
		props,
	})}
		<div
			{...props}
			{@attach modal.prepareNativeSurface}
			style:visibility={modal.nativeSurfaceReady ? undefined : 'hidden'}
		></div>
	{/snippet}
</DialogPrimitive.Overlay>
