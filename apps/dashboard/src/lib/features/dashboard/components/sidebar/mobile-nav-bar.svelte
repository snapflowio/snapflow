<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const BRAND_MARK_SIZE = 32;
const NAVIGATION_TITLE = 'Navigation';
const TOGGLE_LABEL = 'Toggle sidebar';
const PIXEL_SUFFIX = 'px';
const LINK_SELECTOR = 'a[href]';
</script>

<script lang="ts">
import PanelLeft from '@lucide/svelte/icons/panel-left';
import { Dialog } from 'bits-ui';
import BrandMark from '#lib/components/brand-mark.svelte';
import IconButton from '#lib/components/ui/icon-button.svelte';
import {
	ANIMATION_CLASSES,
	MODAL_ANIMATION_DURATION_CLASS,
	OVERLAY_ANIMATION_DURATION_CLASS,
} from '#lib/components/ui/modal/modal-animation.ts';
import { SIDEBAR_WIDTH } from '#lib/features/dashboard/lib/sidebar-constants.ts';
import { getSidebar } from '#lib/features/dashboard/state/sidebar.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { cn } from '#lib/utils/utils.ts';
import { resolve } from '$app/paths';
import Sidebar from './sidebar.svelte';
import SidebarFind from './sidebar-find.svelte';

const sidebar = getSidebar();
let drawer = $state<HTMLElement | null>(null);

function focusDrawer(event: Event): void {
	event.preventDefault();
	drawer?.focus();
}

function closeOnLink(event: MouseEvent): void {
	if (event.target instanceof Element && event.target.closest(LINK_SELECTOR)) {
		sidebar.closeMobile();
	}
}
</script>

<header
	class="sticky top-0 z-20 flex w-full shrink-0 flex-row items-center justify-between bg-surface-1 p-4"
>
	<a
		href={resolve(Path.DASHBOARD)}
		aria-label="Snapflow"
		class="flex shrink-0 items-center outline-none transition-opacity focus-visible:opacity-70"
	>
		<BrandMark size={BRAND_MARK_SIZE} />
	</a>
	<div class="flex flex-row items-center gap-x-6">
		<SidebarFind />
		<IconButton
			variant="ghost"
			size="md"
			label={TOGGLE_LABEL}
			icon={PanelLeft}
			tooltip={false}
			aria-expanded={sidebar.mobileOpen}
			onclick={sidebar.toggle}
		/>
	</div>
</header>

<Dialog.Root bind:open={sidebar.mobileOpen}>
	<Dialog.Portal>
		<Dialog.Overlay
			class={cn(
				'fixed inset-0 z-(--z-modal) bg-black/70',
				ANIMATION_CLASSES,
				OVERLAY_ANIMATION_DURATION_CLASS
			)}
		/>
		<Dialog.Content
			style={`width: ${SIDEBAR_WIDTH.MOBILE}${PIXEL_SUFFIX}`}
			onclick={closeOnLink}
			bind:ref={drawer}
			onOpenAutoFocus={focusDrawer}
			class={cn(
				'fixed inset-y-0 left-0 z-(--z-modal) flex h-full max-w-[calc(100vw-48px)] flex-col border-(--border-subtle) border-r bg-bg outline-none data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
				ANIMATION_CLASSES,
				MODAL_ANIMATION_DURATION_CLASS
			)}
		>
			<Dialog.Title class="sr-only">{NAVIGATION_TITLE}</Dialog.Title>
			<Sidebar />
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
