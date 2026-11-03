<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const MENU_SIDE_OFFSET = 4;
const FALLBACK_ACCOUNT_LABEL = 'Account';

interface SidebarFooterProps {
	collapsed: boolean;
	showDivider: boolean;
}
</script>

<script lang="ts">
import BookOpen from '@lucide/svelte/icons/book-open';
import CircleHelp from '@lucide/svelte/icons/circle-help';
import Credit from '@lucide/svelte/icons/credit-card';
import LogOut from '@lucide/svelte/icons/log-out';
import Settings from '@lucide/svelte/icons/settings';
import ShieldCheck from '@lucide/svelte/icons/shield-check';
import Users from '@lucide/svelte/icons/users';
import { useQueryClient } from '@tanstack/svelte-query';
import { SIGN_OUT_FAILED_MESSAGE, signOut } from '#lib/api/auth/session.ts';
import { showApiError } from '#lib/api/errors/show-api-error.ts';
import { getWebsiteLinks } from '#lib/api/public-config.ts';
import type { IconComponent } from '#lib/components/icons/icon-component.ts';
import Chip, { chipVariants } from '#lib/components/ui/chip/chip.svelte';
import { chipContentLabelClass } from '#lib/components/ui/chip/chip-chrome.ts';
import DropdownMenu from '#lib/components/ui/dropdown-menu/dropdown-menu.svelte';
import DropdownMenuContent from '#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
import DropdownMenuItem from '#lib/components/ui/dropdown-menu/dropdown-menu-item.svelte';
import { MENU_LABEL_CLASS } from '#lib/components/ui/dropdown-menu/dropdown-menu-styles.ts';
import DropdownMenuTrigger from '#lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import {
	SIDEBAR_ITEM_GAP_CLASS,
	SIDEBAR_RAIL_CHIP_CLASS,
} from '#lib/features/dashboard/lib/sidebar-constants.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { cn } from '#lib/utils/utils.ts';
import { resolve } from '$app/paths';

let { collapsed, showDivider }: SidebarFooterProps = $props();

const auth = getAuth();
const queryClient = useQueryClient();
const permission = getOrganizationPermission();
const { docsHref } = getWebsiteLinks();
const name = $derived(
	auth.user?.name?.trim() || auth.user?.email?.trim() || FALLBACK_ACCOUNT_LABEL
);
const links = $derived(
	[
		{
			label: 'Settings',
			icon: Settings,
			href: resolve(Path.ACCOUNT),
			show: true,
		},
		{ label: 'Members', icon: Users, href: resolve(Path.MEMBERS), show: true },
		{
			label: 'Billing',
			icon: Credit,
			href: resolve(Path.BILLING),
			show: permission.can({ billing: ['read'] }),
		},
		{
			label: 'Admin',
			icon: ShieldCheck,
			href: resolve(Path.ADMIN_SETTINGS),
			show: auth.isAdmin,
		},
	].filter((link) => link.show) satisfies {
		label: string;
		icon: IconComponent;
		href: string;
	}[]
);

async function signOutOfAccount(): Promise<void> {
	try {
		await signOut(queryClient);
	} catch (error) {
		showApiError(error, SIGN_OUT_FAILED_MESSAGE);
	}
}
</script>

<div
	class={cn(
		'flex shrink-0 border-t px-2 pt-2.25 pb-2 transition-colors duration-150',
		!showDivider && 'border-transparent',
		collapsed ? cn(SIDEBAR_ITEM_GAP_CLASS, 'flex-col-reverse') : 'items-center'
	)}
>
	<div class={cn('flex min-w-0', !collapsed && 'flex-1')}>
		<DropdownMenu>
			<Tooltip content={name} disabled={!collapsed}>
				{#snippet child({
					props: tooltipProps,
				})}
					<DropdownMenuTrigger {...tooltipProps}>
						{#snippet child({
							props,
						})}
							<button
								{...props}
								type="button"
								aria-label={collapsed
									? `Open account menu for ${name}`
									: undefined}
								class={cn(
									chipVariants({ fullWidth: collapsed }),
									collapsed ? 'min-w-0' : 'max-w-full',
									SIDEBAR_RAIL_CHIP_CLASS
								)}
							>
								<div
									class="flex size-4 shrink-0 items-center justify-center rounded-full bg-brand text-[9px] text-white leading-none"
								>
									{name.charAt(0).toUpperCase()}
								</div>
								<span
									class={cn(
										'sidebar-collapse-hide flex-1',
										chipContentLabelClass
									)}
								>
									{name}
								</span>
							</button>
						{/snippet}
					</DropdownMenuTrigger>
				{/snippet}
			</Tooltip>
			<DropdownMenuContent
				align="start"
				side="top"
				sideOffset={MENU_SIDE_OFFSET}
			>
				{#each links as link (link.href)}
					<DropdownMenuItem>
						{#snippet child({
							props,
						})}
							<a {...props} href={link.href}>
								<link.icon />
								<span class={MENU_LABEL_CLASS}>{link.label}</span>
							</a>
						{/snippet}
					</DropdownMenuItem>
				{/each}
				<DropdownMenuItem onSelect={() => void signOutOfAccount()}>
					<LogOut />
					<span class={MENU_LABEL_CLASS}>Sign out</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	</div>
	<DropdownMenu>
		<Tooltip content="Help" disabled={!collapsed}>
			{#snippet child({
				props: tooltipProps,
			})}
				<DropdownMenuTrigger {...tooltipProps}>
					{#snippet child({
						props,
					})}
						<Chip
							{...props}
							aria-label="Help"
							leftIcon={CircleHelp}
							fullWidth={collapsed}
							class={cn('shrink-0', SIDEBAR_RAIL_CHIP_CLASS)}
						/>
					{/snippet}
				</DropdownMenuTrigger>
			{/snippet}
		</Tooltip>
		<DropdownMenuContent
			align={collapsed ? 'start' : 'end'}
			side="top"
			sideOffset={MENU_SIDE_OFFSET}
		>
			<DropdownMenuItem>
				{#snippet child({
					props,
				})}
					<a
						{...props}
						href={docsHref}
						target="_blank"
						rel="noopener noreferrer"
					>
						<BookOpen />
						<span class={MENU_LABEL_CLASS}>Docs</span>
					</a>
				{/snippet}
			</DropdownMenuItem>
		</DropdownMenuContent>
	</DropdownMenu>
</div>
