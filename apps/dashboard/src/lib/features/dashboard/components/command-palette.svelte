<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import Rocket from '@lucide/svelte/icons/rocket';
import ServerIcon from '@lucide/svelte/icons/server';
import type { IconComponent } from '#lib/components/icons/icon-component.ts';
import { DashboardMode } from '#lib/features/dashboard/lib/dashboard-mode.ts';
import type { OrganizationPermission } from '#lib/features/organizations/lib/organization-permission.ts';
import { Path } from '#lib/routing/paths.ts';

interface PaletteCommand {
	id: string;
	label: string;
	group: string;
	icon: IconComponent;
	keywords?: readonly string[];
	shortcut?: readonly string[];
	opensScope?: boolean;
	run: () => void;
}

const SUB_PAGE_COMMANDS = [
	{
		label: 'Usage',
		path: Path.BILLING_USAGE,
		permission: { billing: ['read'] },
	},
] satisfies readonly {
	label: string;
	path: Path;
	permission: OrganizationPermission;
}[];

const ACTIONS_GROUP = 'Actions';
const RECENT_GROUP = 'Recent';
const PAGES_GROUP = 'Pages';
const RESULTS_GROUP = 'Results';
const BACKSPACE_KEY = 'Backspace';
const PALETTE_HALF_WIDTH = '280px';
const DEFAULT_PLACEHOLDER = 'Search pages, actions and sandboxes';
const TOGGLE_SIDEBAR_SHORTCUT = ['mod', 'B'] as const;
const SCOPE_SEPARATOR = '›';
const MODE_SWITCH_COMMANDS = {
	[DashboardMode.Deploy]: { label: 'Switch to Deploy', icon: Rocket },
	[DashboardMode.Host]: { label: 'Switch to Host', icon: ServerIcon },
} as const satisfies Record<
	DashboardMode,
	{ label: string; icon: IconComponent }
>;
const ITEM_CLASS =
	'group flex h-9 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-sm scroll-my-1 outline-none transition-none data-selected:bg-surface-3 data-disabled:pointer-events-none data-disabled:opacity-50';
const GROUP_HEADING_CLASS =
	'flex scroll-mt-1 items-center px-2 py-1.5 font-medium text-(--text-subtle) text-xs';
const LEGEND_CLASS = 'flex items-center gap-1.5';
</script>

<script lang="ts">
import ChevronRight from '@lucide/svelte/icons/chevron-right';
import FileText from '@lucide/svelte/icons/file-text';
import PanelLeft from '@lucide/svelte/icons/panel-left';
import Plus from '@lucide/svelte/icons/plus';
import Search from '@lucide/svelte/icons/search';
import X from '@lucide/svelte/icons/x';
import { Command, Dialog } from 'bits-ui';
import { watch } from 'runed';
import {
	DOUBLE_FRAME_INNER_CLASS,
	DOUBLE_FRAME_OUTER_CLASS,
} from '#lib/components/ui/chip/chip-chrome.ts';
import Kbd from '#lib/components/ui/kbd.svelte';
import { scrollEdges } from '#lib/components/ui/overflow/scroll-fade.ts';
import { rankCommands } from '#lib/features/dashboard/lib/command-ranking.ts';
import {
	CREATE_COMMANDS,
	createCommandHref,
} from '#lib/features/dashboard/lib/create-commands.ts';
import {
	type PaletteRecent,
	readPaletteRecents,
	rememberPaletteRecent,
} from '#lib/features/dashboard/lib/palette-recents.ts';
import {
	PALETTE_SCOPES,
	type PaletteScopeItem,
} from '#lib/features/dashboard/lib/palette-scopes.ts';
import { getDashboardMode } from '#lib/features/dashboard/state/dashboard-mode.svelte.ts';
import {
	DASHBOARD_ITEM_ICONS,
	getDashboardNavigation,
} from '#lib/features/dashboard/state/dashboard-navigation.svelte.ts';
import { getGlobalCommands } from '#lib/features/dashboard/state/global-commands.svelte.ts';
import { PaletteSearch } from '#lib/features/dashboard/state/palette-search.svelte.ts';
import { getSidebar } from '#lib/features/dashboard/state/sidebar.svelte.ts';
import { resolvePath } from '#lib/routing/paths.ts';
import { cn } from '#lib/utils/utils.ts';
import { goto } from '$app/navigation';

const navigation = getDashboardNavigation();
const mode = getDashboardMode();
const otherMode = $derived(
	mode.current === DashboardMode.Deploy
		? DashboardMode.Host
		: DashboardMode.Deploy
);
const commands = getGlobalCommands();
const sidebar = getSidebar();
const palette = new PaletteSearch();
let recents = $state<readonly PaletteRecent[]>(readPaletteRecents());

watch(
	() => commands.paletteOpen,
	(open) => {
		if (open) recents = readPaletteRecents();
	},
	{ lazy: true }
);

function visit(recent: PaletteRecent): () => void {
	return () => {
		recents = rememberPaletteRecent(recent);
		void goto(recent.href);
	};
}

function pageCommand(
	id: string,
	label: string,
	group: string,
	icon: IconComponent,
	href: string,
	keywords?: readonly string[]
): PaletteCommand {
	return {
		id,
		label,
		group,
		icon,
		keywords,
		run: visit({ id, label, href, scope: null }),
	};
}

function scopeItemCommand(item: PaletteScopeItem): PaletteCommand {
	const scope = PALETTE_SCOPES[item.scope];
	return {
		id: item.id,
		label: item.label,
		group: scope.label,
		icon: scope.icon,
		run: visit({
			id: item.id,
			label: item.label,
			href: item.href,
			scope: item.scope,
		}),
	};
}

const actionCommands: readonly PaletteCommand[] = $derived([
	...Object.values(CREATE_COMMANDS)
		.filter((command) => navigation.permission.can(command.permission))
		.map((command) => ({
			id: command.id,
			label: command.label,
			group: ACTIONS_GROUP,
			icon: Plus,
			run: () => void goto(createCommandHref(command)),
		})),
	...palette.scopes.map((scope) => ({
		id: `scope-${scope.id}`,
		label: `Search ${scope.label.toLowerCase()}`,
		group: ACTIONS_GROUP,
		icon: scope.icon,
		keywords: [scope.label],
		opensScope: true,
		run: () => palette.enter(scope.id),
	})),
	{
		id: 'switch-mode',
		label: MODE_SWITCH_COMMANDS[otherMode].label,
		group: ACTIONS_GROUP,
		icon: MODE_SWITCH_COMMANDS[otherMode].icon,
		run: () => navigation.switchMode(otherMode),
	},
	...(sidebar.isMobile
		? [
				{
					id: 'toggle-sidebar',
					label: 'Toggle sidebar',
					group: ACTIONS_GROUP,
					icon: PanelLeft,
					shortcut: TOGGLE_SIDEBAR_SHORTCUT,
					run: sidebar.toggle,
				},
			]
		: []),
]);

const pageCommands: readonly PaletteCommand[] = $derived([
	...navigation.allPages.flatMap((group) =>
		group.items.map((item) =>
			pageCommand(
				item.path,
				item.label,
				PAGES_GROUP,
				DASHBOARD_ITEM_ICONS[item.id],
				resolvePath(item.path),
				group.label ? [group.label] : undefined
			)
		)
	),
	...SUB_PAGE_COMMANDS.filter((command) =>
		navigation.permission.can(command.permission)
	).map((command) =>
		pageCommand(
			command.path,
			command.label,
			PAGES_GROUP,
			FileText,
			resolvePath(command.path)
		)
	),
	...[...navigation.settings, ...navigation.admin].flatMap((group) =>
		group.items.map((item) =>
			pageCommand(
				item.path,
				item.label,
				group.label ?? PAGES_GROUP,
				DASHBOARD_ITEM_ICONS[item.id],
				resolvePath(item.path),
				group.label ? [group.label] : undefined
			)
		)
	),
]);

const pageIcons = $derived(
	new Map(pageCommands.map((command) => [command.id, command.icon]))
);

const recentCommands: readonly PaletteCommand[] = $derived(
	recents.map((recent) => ({
		id: `recent-${recent.href}`,
		label: recent.label,
		group: RECENT_GROUP,
		icon: recent.scope
			? PALETTE_SCOPES[recent.scope].icon
			: (pageIcons.get(recent.id) ?? FileText),
		run: visit(recent),
	}))
);

const searching = $derived(palette.search.trim().length > 0);
const scoped = $derived(palette.activeScope);
const scopeResults = $derived(palette.items.map(scopeItemCommand));

const groups = $derived.by(() => {
	if (scoped) {
		return [{ heading: scoped.label, items: scopeResults }].filter(
			(group) => group.items.length > 0
		);
	}
	if (searching) {
		return [
			{
				heading: RESULTS_GROUP,
				items: rankCommands(
					[...actionCommands, ...pageCommands],
					palette.search
				),
			},
			{ heading: PALETTE_SCOPES.sandboxes.label, items: scopeResults },
		].filter((group) => group.items.length > 0);
	}
	return [
		{ heading: RECENT_GROUP, items: recentCommands },
		{ heading: ACTIONS_GROUP, items: actionCommands },
	].filter((group) => group.items.length > 0);
});

const emptyMessage = $derived.by(() => {
	if (palette.fetching) return 'Searching…';
	const term = palette.search.trim();
	return term ? `No results for “${term}”` : 'Nothing to show yet';
});
const placeholder = $derived(scoped?.placeholder ?? DEFAULT_PLACEHOLDER);
const escapeHint = $derived(scoped || searching ? 'Clear' : 'Close');

function handleOpenChange(open: boolean): void {
	commands.paletteOpen = open;
	if (!open) palette.reset();
}

function runCommand(command: PaletteCommand): void {
	if (command.opensScope) {
		command.run();
		return;
	}
	handleOpenChange(false);
	command.run();
}

function handleEscape(event: KeyboardEvent): void {
	if (palette.search) {
		event.preventDefault();
		palette.search = '';
		return;
	}
	if (palette.scope) {
		event.preventDefault();
		palette.scope = null;
	}
}

function handleInputKeydown(event: KeyboardEvent): void {
	if (event.key === BACKSPACE_KEY && !palette.search && palette.scope) {
		event.preventDefault();
		palette.scope = null;
	}
}
</script>

<Dialog.Root open={commands.paletteOpen} onOpenChange={handleOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-(--z-modal) bg-black/70" />
		<Dialog.Content aria-label="Search" onEscapeKeydown={handleEscape}>
			{#snippet child({ props })}
				<div
					{...props}
					class={cn(
						'fixed top-[15%] z-(--z-modal) w-[min(560px,calc(100%-32px))] -translate-x-1/2 outline-none',
						DOUBLE_FRAME_OUTER_CLASS
					)}
					style:left={`clamp(calc(16px + ${PALETTE_HALF_WIDTH}), calc(var(--content-offset) / 2 + 50%), calc(100% - 16px - ${PALETTE_HALF_WIDTH}))`}
				>
					<Dialog.Title class="sr-only">Search</Dialog.Title>
					<div class={DOUBLE_FRAME_INNER_CLASS}>
						<Command.Root label="Search" shouldFilter={false} loop>
							<div class="relative">
								<div
									class="flex h-11 cursor-text items-center gap-2 border-border border-b px-3.5"
								>
									<Search class="size-4 shrink-0 text-(--text-subtle)" />
									{#if scoped}
										<span
											class="inline-flex h-6.5 shrink-0 items-center gap-2 rounded-lg bg-surface-3 pr-1.5 pl-2 text-(--text-primary) text-xs"
										>
											{scoped.label}
											<span aria-hidden="true" class="text-(--text-subtle)">
												{SCOPE_SEPARATOR}
											</span>
											<button
												type="button"
												aria-label={`Leave ${scoped.label} search`}
												class="inline-flex size-4 cursor-pointer items-center justify-center rounded-xs text-(--text-icon) outline-none hover-hover:text-(--text-primary) focus-visible:focus-ring-inset"
												onclick={() => (palette.scope = null)}
											>
												<X class="size-3" />
											</button>
										</span>
									{/if}
									<Command.Input
										bind:value={palette.search}
										{placeholder}
										onkeydown={handleInputKeydown}
										class="h-11 min-w-0 flex-1 cursor-text bg-transparent text-(--text-primary) text-sm outline-none placeholder:text-(--text-subtle)"
									/>
								</div>
								<Command.List
									{@attach scrollEdges()}
									class="scroll-fade max-h-[min(420px,calc(85dvh-96px))] overflow-y-auto overflow-x-hidden p-1.5 scrollbar-none"
								>
									<Command.Viewport>
										<Command.Empty
											class="flex items-center justify-center px-4 py-6 text-(--text-subtle) text-sm"
										>
											{emptyMessage}
										</Command.Empty>
										{#each groups as group, index (group.heading)}
											<Command.Group class={index > 0 ? 'mt-2' : undefined}>
												{#if group.heading !== RESULTS_GROUP}
													<Command.GroupHeading class={GROUP_HEADING_CLASS}>
														{group.heading}
													</Command.GroupHeading>
												{/if}
												<Command.GroupItems class="flex flex-col gap-px">
													{#each group.items as command (command.id)}
														<Command.Item
															value={command.id}
															onSelect={() => runCommand(command)}
															class={ITEM_CLASS}
														>
															<command.icon
																class="size-4 shrink-0 text-(--text-subtle) group-data-selected:text-(--text-primary)"
															/>
															<span
																class="min-w-0 truncate text-(--text-body) group-data-selected:text-(--text-primary)"
															>
																{command.label}
															</span>
															{#if command.shortcut}
																<Kbd
																	keys={command.shortcut}
																	class="ml-auto pl-2"
																/>
															{:else if command.opensScope}
																<ChevronRight
																	class="ml-auto size-3.5 shrink-0 text-(--text-subtle)"
																/>
															{:else if searching && !scoped}
																<span
																	class="ml-auto shrink-0 pl-2 text-(--text-subtle) text-xs"
																>
																	{command.group}
																</span>
															{/if}
														</Command.Item>
													{/each}
												</Command.GroupItems>
											</Command.Group>
										{/each}
									</Command.Viewport>
								</Command.List>
							</div>
						</Command.Root>
						<div
							class="flex h-9 items-center justify-between border-border border-t px-3.5 text-(--text-subtle) text-xs pointer-coarse:hidden"
						>
							<span class={LEGEND_CLASS}>
								<Kbd keys={['up', 'down']} />
								Navigate
							</span>
							<span class="flex items-center gap-3">
								<span class={LEGEND_CLASS}>
									<Kbd keys={['enter']} />
									Open
								</span>
								<span class={LEGEND_CLASS}>
									<Kbd keys={['esc']} />
									{escapeHint}
								</span>
							</span>
						</div>
					</div>
				</div>
			{/snippet}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
