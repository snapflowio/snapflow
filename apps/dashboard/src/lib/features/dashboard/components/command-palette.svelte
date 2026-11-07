<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { IconComponent } from '#lib/components/icons/icon-component.ts';
import type { OrganizationPermission } from '#lib/features/organizations/lib/organization-permission.ts';
import { Path, resolvePath } from '#lib/routing/paths.ts';

interface PaletteCommand {
	id: string;
	label: string;
	group: string;
	icon: IconComponent;
	keywords?: readonly string[];
	meta?: string;
	run: () => void;
}

const SUB_PAGE_COMMANDS = [
	{
		label: 'My listings',
		path: Path.LISTINGS_MINE,
		permission: { listings: ['read'] },
	},
	{
		label: 'Payout wallet',
		path: Path.EARNINGS_PAYOUTS,
		permission: { payouts: ['read'] },
	},
	{
		label: 'Fund escrow',
		path: Path.BILLING_FUNDING,
		permission: { billing: ['manage'] },
	},
	{
		label: 'Payment channels',
		path: Path.BILLING_PAYMENTS,
		permission: { billing: ['read'] },
	},
	{
		label: 'Statements',
		path: Path.BILLING_STATEMENTS,
		permission: { billing: ['read'] },
	},
] satisfies readonly {
	label: string;
	path: Path;
	permission: OrganizationPermission;
}[];

const ACTIONS_GROUP = 'Actions';
const PAGES_GROUP = 'Pages';
const RESULTS_GROUP = 'Results';
const PALETTE_HALF_WIDTH = '250px';
const ITEM_CLASS =
	'group mx-0.5 flex h-7.5 w-full cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2 text-left text-sm scroll-mt-12 scroll-mb-1.5 outline-none data-selected:border-border data-selected:bg-surface-active data-disabled:pointer-events-none data-disabled:opacity-50';
const GROUP_HEADING_CLASS =
	'mb-2 flex h-4.5 scroll-mt-12 items-center px-2 text-(--text-muted) text-small';
</script>

<script lang="ts">
import FileText from '@lucide/svelte/icons/file-text';
import PanelLeft from '@lucide/svelte/icons/panel-left';
import Search from '@lucide/svelte/icons/search';
import { Command, Dialog } from 'bits-ui';
import { scrollEdges } from '#lib/components/ui/overflow/scroll-fade.ts';
import { rankCommands } from '#lib/features/dashboard/lib/command-ranking.ts';
import {
	DASHBOARD_ITEM_ICONS,
	getDashboardNavigation,
} from '#lib/features/dashboard/state/dashboard-navigation.svelte.ts';
import { getGlobalCommands } from '#lib/features/dashboard/state/global-commands.svelte.ts';
import { getSidebar } from '#lib/features/dashboard/state/sidebar.svelte.ts';
import { shortcutLabel } from '#lib/utils/keyboard.ts';
import { goto } from '$app/navigation';

const navigation = getDashboardNavigation();
const commands = getGlobalCommands();
const sidebar = getSidebar();
let search = $state('');

function navigateTo(href: string): () => void {
	return () => void goto(href);
}

const allCommands: readonly PaletteCommand[] = $derived([
	{
		id: 'toggle-sidebar',
		label: 'Toggle sidebar',
		group: ACTIONS_GROUP,
		icon: PanelLeft,
		meta: shortcutLabel('B'),
		run: sidebar.toggle,
	},
	...navigation.workspace.flatMap((group) =>
		group.items.map((item) => ({
			id: item.path,
			label: item.label,
			group: PAGES_GROUP,
			icon: DASHBOARD_ITEM_ICONS[item.id],
			keywords: [group.label],
			run: navigateTo(resolvePath(item.path)),
		}))
	),
	...SUB_PAGE_COMMANDS.filter((command) =>
		navigation.permission.can(command.permission)
	).map((command) => ({
		id: command.path,
		label: command.label,
		group: PAGES_GROUP,
		icon: FileText,
		run: navigateTo(resolvePath(command.path)),
	})),
	...[...navigation.settings, ...navigation.admin].flatMap((group) =>
		group.items.map((item) => ({
			id: item.path,
			label: item.label,
			group: group.label,
			icon: DASHBOARD_ITEM_ICONS[item.id],
			keywords: [group.label],
			run: navigateTo(resolvePath(item.path)),
		}))
	),
]);

const searching = $derived(search.trim().length > 0);
const groups = $derived.by(() => {
	if (searching) {
		return [
			{ heading: RESULTS_GROUP, items: rankCommands(allCommands, search) },
		];
	}
	const grouped = new Map<string, PaletteCommand[]>();
	for (const command of allCommands) {
		grouped.set(command.group, [
			...(grouped.get(command.group) ?? []),
			command,
		]);
	}
	return [...grouped].map(([heading, items]) => ({ heading, items }));
});

function handleOpenChange(open: boolean): void {
	commands.paletteOpen = open;
	if (!open) search = '';
}

function runCommand(command: PaletteCommand): void {
	handleOpenChange(false);
	command.run();
}
</script>

<Dialog.Root open={commands.paletteOpen} onOpenChange={handleOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay
			class="fixed inset-0 z-(--z-modal) data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-100"
		/>
		<Dialog.Content aria-label="Search">
			{#snippet child({
				props,
			})}
				<div
					{...props}
					class="fixed top-[15%] z-(--z-modal) w-[min(500px,calc(100%-32px))] -translate-x-1/2 rounded-xl border border-border bg-surface-5 p-0.75 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-100"
					style:left={`clamp(calc(16px + ${PALETTE_HALF_WIDTH}), calc(var(--content-offset) / 2 + 50%), calc(100% - 16px - ${PALETTE_HALF_WIDTH}))`}
				>
					<Dialog.Title class="sr-only">Search</Dialog.Title>
					<div class="overflow-hidden rounded-lg border border-border bg-bg">
						<Command.Root label="Search" shouldFilter={false} loop>
							<div class="relative">
								<div
									class="absolute inset-x-0 top-0 z-20 flex h-12 cursor-text items-center gap-2 rounded-t-[13px] bg-[linear-gradient(to_bottom,var(--bg)_0%,color-mix(in_srgb,var(--bg)_88%,transparent)_68%,transparent_100%)] px-2.5 pb-2"
								>
									<Search class="size-3.5 shrink-0 text-(--text-muted)" />
									<Command.Input
										bind:value={search}
										placeholder="Search anything..."
										class="-ml-1 h-8 min-w-0 flex-1 cursor-text bg-transparent indent-1 text-(--text-body) text-sm outline-none placeholder:text-(--text-muted)"
									/>
								</div>
								<Command.List
									{@attach scrollEdges()}
									class="scroll-fade max-h-[min(448px,calc(85dvh-26px))] overflow-y-auto overflow-x-hidden px-1.5 pt-12 pb-1.5 scrollbar-none"
								>
									<Command.Viewport>
										<Command.Empty
											class="flex items-center justify-center px-4 py-6 text-(--text-subtle) text-sm"
										>
											No results found.
										</Command.Empty>
										{#each groups as group, index (group.heading)}
											<Command.Group class={index > 0 ? 'mt-4' : undefined}>
												{#if !searching}
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
																class="size-4 shrink-0 text-(--text-icon)"
															/>
															<span class="min-w-0 truncate text-(--text-body)">
																{command.label}
															</span>
															{#if command.meta}
																<span
																	class="ml-auto shrink-0 pl-2 text-(--text-subtle) text-small"
																>
																	{command.meta}
																</span>
															{:else if searching}
																<span
																	class="ml-auto shrink-0 pl-2 text-(--text-subtle) text-small"
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
					</div>
				</div>
			{/snippet}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
