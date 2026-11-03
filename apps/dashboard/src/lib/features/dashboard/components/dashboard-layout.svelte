<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const PALETTE_KEY = 'k';
const SIDEBAR_KEY = 'b';
const NAVIGATION_ID = 'app-navigation';
</script>

<script lang="ts">
import PanelLeft from '@lucide/svelte/icons/panel-left';
import X from '@lucide/svelte/icons/x';
import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import type { Snippet } from 'svelte';
import { stopImpersonatingMutationOptions } from '#lib/api/admin/users.ts';
import SnapflowStaticOverlay from '#lib/components/snapflow-static-overlay.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ResizeHandle from '#lib/components/ui/resize-handle/resize-handle.svelte';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import {
	networkBudgetAlertDescription,
	networkBudgetAlertTitle,
} from '#lib/features/billing/lib/network-budget-alert.ts';
import { SIDEBAR_WIDTH } from '#lib/features/dashboard/lib/sidebar-constants.ts';
import {
	clearSidebarWidthPreview,
	previewSidebarWidth,
	SIDEBAR_RESIZING_CLASS,
} from '#lib/features/dashboard/lib/sidebar-resize.ts';
import {
	DashboardNavigation,
	setDashboardNavigation,
} from '#lib/features/dashboard/state/dashboard-navigation.svelte.ts';
import {
	GlobalCommands,
	setGlobalCommands,
} from '#lib/features/dashboard/state/global-commands.svelte.ts';
import {
	SidebarState,
	setSidebar,
} from '#lib/features/dashboard/state/sidebar.svelte.ts';

import { openNotificationSocket } from '#lib/integrations/notifications/notification-connection.ts';
import { Path } from '#lib/routing/paths.ts';
import { cn } from '#lib/utils/utils.ts';
import { afterNavigate, goto } from '$app/navigation';
import { resolve } from '$app/paths';
import CommandPalette from './command-palette.svelte';
import Sidebar from './sidebar/sidebar.svelte';

interface DashboardLayoutProps {
	readonly children: Snippet;
}

let { children }: DashboardLayoutProps = $props();

const auth = getAuth();
let sidebarShell = $state<HTMLElement>();
const navigation = setDashboardNavigation(new DashboardNavigation());
const sidebar = setSidebar(new SidebarState());
const commands = setGlobalCommands(new GlobalCommands());
const queryClient = useQueryClient();
const userId = $derived(auth.user?.id);
const impersonatedEmail = $derived(
	auth.session?.session.impersonatedBy ? (auth.user?.email ?? '') : null
);

commands.register({
	id: 'command-palette',
	label: 'Search',
	key: PALETTE_KEY,
	mod: true,
	allowInEditable: true,
	run: commands.togglePalette,
});
commands.register({
	id: 'toggle-sidebar',
	label: 'Toggle sidebar',
	key: SIDEBAR_KEY,
	mod: true,
	allowInEditable: false,
	run: sidebar.toggle,
});

afterNavigate(({ to }) => {
	sidebar.closeMobile();
	if (to) navigation.rememberReturnUrl(to.url);
});

const stopImpersonating = createMutation(() => ({
	...stopImpersonatingMutationOptions(),
	onSuccess: async () => {
		await auth.refetch();
		await goto(resolve(Path.ADMIN_USERS), { replace: true });
	},
}));

function handleWindowKeydown(event: KeyboardEvent): void {
	if (event.key === 'Escape' && sidebar.mobileOpen) {
		sidebar.closeMobile();
	}
}

$effect(() => {
	if (!userId) return;
	return openNotificationSocket(queryClient, auth.activeOrganizationId, {
		onNetworkBudgetAlert: (alert) =>
			toast.warning(networkBudgetAlertTitle(alert), {
				description: networkBudgetAlertDescription(alert),
			}),
		onSessionRejected: () => void auth.refetch(),
	});
});
</script>

<svelte:window
	onkeydowncapture={commands.handleKeydown}
	onkeydown={handleWindowKeydown}
/>
<svelte:document {@attach sidebar.attachDocument} />

<div
	class="workspace-root flex h-dvh w-full flex-col overflow-hidden bg-surface-1"
>
	{#if impersonatedEmail !== null}
		<div class="shrink-0 bg-surface-active px-6 py-2.5">
			<div class="mx-auto flex max-w-350 items-center justify-between gap-3">
				<p class="text-small">
					You are impersonating {impersonatedEmail || 'another user'}.
				</p>
				<Chip
					class="h-7 shrink-0 px-2 text-caption"
					disabled={stopImpersonating.isPending}
					onclick={() => stopImpersonating.mutate()}
				>
					Stop impersonating
				</Chip>
			</div>
		</div>
	{/if}
	<div class="relative flex min-h-0 flex-1 flex-col md:flex-row">
		<div
			class="flex shrink-0 items-center border-border border-b bg-surface-1 px-2 md:hidden"
		>
			<Chip
				mobileIconOnly
				leftIcon={sidebar.mobileOpen ? X : PanelLeft}
				aria-label={sidebar.mobileOpen ? 'Close navigation' : 'Open navigation'}
				aria-expanded={sidebar.mobileOpen}
				aria-controls={NAVIGATION_ID}
				onclick={sidebar.toggle}
			>
				{sidebar.mobileOpen ? 'Close navigation' : 'Navigation'}
			</Chip>
		</div>
		<div
			bind:this={sidebarShell}
			id={NAVIGATION_ID}
			class={cn(
				'sidebar-shell relative shrink-0 overflow-hidden md:w-(--sidebar-width)',
				sidebar.mobileOpen
					? 'max-md:min-h-0 max-md:w-full max-md:flex-1'
					: 'max-md:hidden'
			)}
			data-collapsed={sidebar.railCollapsed || undefined}
			inert={sidebar.isMobile && !sidebar.mobileOpen}
		>
			<div class="h-full w-full">
				<Sidebar collapsed={sidebar.railCollapsed} />
			</div>
			{#if sidebar.railCollapsed}
				<button
					type="button"
					aria-label="Expand sidebar"
					class="absolute top-0 right-0 bottom-0 z-20 hidden w-2 translate-x-1/2 cursor-e-resize md:block"
					onclick={() => sidebar.setCollapsed(false)}
				></button>
			{:else}
				<ResizeHandle
					label="Resize sidebar"
					edge="right"
					class="z-20 hidden md:block"
					value={sidebar.expandedWidth}
					min={SIDEBAR_WIDTH.MIN}
					max={sidebar.resizeMaximum}
					resizingClass={SIDEBAR_RESIZING_CLASS}
					widthAt={sidebar.clampWidth}
					onResize={(width) => previewSidebarWidth(sidebarShell, width)}
					onCommit={(width) => {
						clearSidebarWidthPreview(sidebarShell);
						sidebar.commitWidth(width);
					}}
				/>
			{/if}
		</div>
		<div
			class={cn(
				'flex min-h-0 min-w-0 flex-1 flex-col',
				sidebar.mobileOpen && 'max-md:hidden'
			)}
			inert={sidebar.mobileOpen}
		>
			<main
				class="relative flex min-h-0 flex-1 flex-col overflow-hidden border-border border-l bg-bg max-md:border-l-0"
			>
				{@render children()}
			</main>
		</div>
	</div>
</div>
<CommandPalette />
<SnapflowStaticOverlay />
