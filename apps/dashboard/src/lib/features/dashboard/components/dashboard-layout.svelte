<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { DashboardAsideVariant } from '#lib/components/page/page-aside.svelte.ts';

const PALETTE_KEY = 'k';
const SIDEBAR_KEY = 'b';
const MAIN_CONTENT_ID = 'main';
const PIXEL_SUFFIX = 'px';

const ASIDE_VARIANT_CLASS: Record<DashboardAsideVariant, string> = {
	context:
		'hidden w-full flex-1 flex-col gap-2 overflow-y-auto rounded-2xl border border-(--border-subtle) bg-surface-1 shadow-xs md:flex md:max-w-[320px] xl:max-w-[440px] has-[[data-context-card]]:rounded-none has-[[data-context-card]]:border-none has-[[data-context-card]]:bg-transparent has-[[data-context-card]]:shadow-none',
	panel:
		'flex flex-col overflow-hidden bg-surface-1 animate-in fade-in-0 slide-in-from-right-2 duration-(--motion-emphasis) ease-(--ease-enter) motion-reduce:animate-none max-lg:fixed max-lg:inset-0 max-lg:z-(--z-modal) lg:relative lg:w-[var(--aside-width,400px)] lg:shrink-0 lg:rounded-2xl lg:border lg:border-(--border-subtle) lg:shadow-xs',
};
const ASIDE_TRANSPARENT_CLASS =
	'rounded-none border-none bg-transparent shadow-none';
</script>

<script lang="ts">
import { useQueryClient } from '@tanstack/svelte-query';
import { watch } from 'runed';
import type { Snippet } from 'svelte';
import {
	type AuthSession,
	fetchCurrentSession,
} from '#lib/api/auth/session.ts';
import { dashboardAside } from '#lib/components/page/page-aside.svelte.ts';
import PageBanner from '#lib/components/page-banner/page-banner.svelte';
import SnapflowStaticOverlay from '#lib/components/snapflow-static-overlay.svelte';
import SessionExpired from '#lib/features/auth/components/session-expired.svelte';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import PageBannerSources from '#lib/features/dashboard/components/page-banner-sources.svelte';
import { crossFadePage } from '#lib/features/dashboard/lib/page-transition.ts';
import { rememberPaletteRecent } from '#lib/features/dashboard/lib/palette-recents.ts';
import { SIDEBAR_NAVIGATION_ID } from '#lib/features/dashboard/lib/sidebar-constants.ts';
import {
	DashboardModeState,
	setDashboardMode,
} from '#lib/features/dashboard/state/dashboard-mode.svelte.ts';
import {
	DashboardNavigation,
	routeMode,
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
import TermsUpdateGate from '#lib/features/legal/components/terms-update-gate.svelte';
import { WalletProvisioning } from '#lib/features/wallet/state/wallet-provisioning.svelte.ts';
import { openNotificationSocket } from '#lib/integrations/notifications/notification-connection.ts';
import { resolvePath } from '#lib/routing/paths.ts';
import { cn } from '#lib/utils/utils.ts';
import { afterNavigate, onNavigate } from '$app/navigation';
import MobileNavBar from './sidebar/mobile-nav-bar.svelte';
import Sidebar from './sidebar/sidebar.svelte';
import SidebarRail from './sidebar/sidebar-rail.svelte';
import SkipToContent from './skip-to-content.svelte';

interface DashboardLayoutProps {
	readonly children: Snippet;
}

let { children }: DashboardLayoutProps = $props();

const auth = getAuth();
let mainContent = $state<HTMLElement>();
const mode = setDashboardMode(new DashboardModeState());
const navigation = setDashboardNavigation(new DashboardNavigation());
const sidebar = setSidebar(new SidebarState());
const commands = setGlobalCommands(new GlobalCommands());
new WalletProvisioning();
let sessionExpired = $state(false);
const queryClient = useQueryClient();
const userId = $derived(auth.user?.id);
const aside = $derived(dashboardAside.current);
let commandPalette = $state.raw<Promise<
	typeof import('./command-palette.svelte')
> | null>(null);

watch(
	() => commands.paletteOpen,
	(open) => {
		if (open) commandPalette ??= import('./command-palette.svelte');
	}
);

watch(
	() => sidebar.isMobile,
	() => sidebar.closeMobile(),
	{ lazy: true }
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

onNavigate(crossFadePage);

afterNavigate(({ to }) => {
	sidebar.closeMobile();
	if (!to) return;
	const visited = navigation.pageAt(to.url.pathname);
	if (visited) {
		rememberPaletteRecent({
			id: visited.path,
			label: visited.label,
			href: resolvePath(visited.path),
			scope: null,
		});
	}
	const routed = routeMode(to.url.pathname);
	if (routed) mode.set(routed);
});

async function confirmSession(): Promise<void> {
	let session: AuthSession | null;
	try {
		session = await fetchCurrentSession();
	} catch {
		await auth.refetch();
		return;
	}
	if (session) await auth.refetch();
	else sessionExpired = true;
}

$effect(() => {
	if (!userId) return;
	return openNotificationSocket(queryClient, auth.activeOrganizationId, {
		onSessionRejected: () => void confirmSession(),
	});
});
</script>

<svelte:window onkeydowncapture={commands.handleKeydown} />
<svelte:document {@attach sidebar.attachDocument} />

<TermsUpdateGate>
	<div
		class="workspace-root flex h-dvh w-full flex-col overflow-hidden bg-bg md:flex-row"
	>
		<SkipToContent targetId={MAIN_CONTENT_ID} target={mainContent} />
		{#if sidebar.isMobile}
			<MobileNavBar />
		{:else}
			<div
				id={SIDEBAR_NAVIGATION_ID}
				class="relative h-full min-w-0 shrink-0 p-2 transition-[width] duration-(--motion-standard) ease-linear motion-reduce:transition-none"
				style:width={`${sidebar.width}${PIXEL_SUFFIX}`}
			>
				<Sidebar />
				<SidebarRail />
			</div>
		{/if}
		<div class="flex min-h-0 min-w-0 flex-1 flex-row gap-x-2 md:p-2">
			<main
				bind:this={mainContent}
				id={MAIN_CONTENT_ID}
				tabindex="-1"
				class="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-1 outline-none md:rounded-2xl md:border md:border-(--border-subtle) md:shadow-xs"
			>
				<PageBanner placement="shell" />
				<PageBannerSources />
				<div class="page-content relative flex min-h-0 flex-1 flex-col">
					{@render children()}
				</div>
			</main>
			{#if aside}
				<aside
					aria-label={aside.label}
					class={cn(
						ASIDE_VARIANT_CLASS[aside.variant],
						aside.transparent && ASIDE_TRANSPARENT_CLASS
					)}
					style:--aside-width={aside.width === undefined
						? undefined
						: `${aside.width}${PIXEL_SUFFIX}`}
				>
					{@render aside.content()}
				</aside>
			{/if}
		</div>
	</div>
	{#if commandPalette}
		{#await commandPalette then { default: CommandPalette }}
			<CommandPalette />
		{/await}
	{/if}
	{#if sessionExpired}
		<SessionExpired />
	{/if}
</TermsUpdateGate>
<SnapflowStaticOverlay />

<style>
.page-content {
	view-transition-name: dashboard-page;
}

:global(::view-transition-old(root)) {
	animation: none;
	opacity: 0;
}

:global(::view-transition-new(root)) {
	animation: none;
}

:global(::view-transition-group(dashboard-page)),
:global(::view-transition-old(dashboard-page)),
:global(::view-transition-new(dashboard-page)) {
	animation-duration: var(--motion-page);
	animation-timing-function: var(--ease-standard);
}
</style>
