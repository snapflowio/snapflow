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
import { DashboardMode } from '#lib/features/dashboard/lib/dashboard-mode.ts';

const ACCOUNT_LABEL = 'Account';
const MODE_GROUP_LABEL = 'Mode';
const HELP_GROUP_LABEL = 'Help';
const ACCOUNT_GROUP_SUFFIX = 'account';
const HELP_GROUP_SUFFIX = 'help';
const START_HOSTING_LABEL = 'Start hosting';
const EXTERNAL_TARGET = '_blank';
const EXTERNAL_REL = 'noopener noreferrer';
const MENU_ITEM_SIZE = 'lg';
const MENU_SIDE = 'top';
const MENU_ALIGN = 'start';
const MENU_COLLAPSED_SIDE = 'right';
const MENU_COLLAPSED_ALIGN = 'end';

const MODE_ICONS = {
	[DashboardMode.Deploy]: Rocket,
	[DashboardMode.Host]: ServerIcon,
} as const;

const MODE_LABELS = {
	[DashboardMode.Deploy]: 'Deploy',
	[DashboardMode.Host]: 'Host',
} as const satisfies Record<DashboardMode, string>;

const MODE_ORDER = [DashboardMode.Deploy, DashboardMode.Host] as const;
</script>

<script lang="ts">
import BookOpen from '@lucide/svelte/icons/book-open';
import Cookie from '@lucide/svelte/icons/cookie';
import Flag from '@lucide/svelte/icons/flag';
import LifeBuoy from '@lucide/svelte/icons/life-buoy';
import LogOut from '@lucide/svelte/icons/log-out';
import { openConsentSettings } from '@snapflow/consent';
import { useQueryClient } from '@tanstack/svelte-query';
import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
import { SIGN_OUT_FAILED_MESSAGE, signOut } from '#lib/api/auth/session.ts';
import { showApiError } from '#lib/api/errors/show-api-error.ts';
import { getPublicConfig, getWebsiteLinks } from '#lib/api/public-config.ts';
import DropdownMenu from '#lib/components/ui/dropdown-menu/dropdown-menu.svelte';
import DropdownMenuContent from '#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
import DropdownMenuItem from '#lib/components/ui/dropdown-menu/dropdown-menu-item.svelte';
import DropdownMenuLabel from '#lib/components/ui/dropdown-menu/dropdown-menu-label.svelte';
import DropdownMenuRadioGroup from '#lib/components/ui/dropdown-menu/dropdown-menu-radio-group.svelte';
import DropdownMenuRadioItem from '#lib/components/ui/dropdown-menu/dropdown-menu-radio-item.svelte';
import DropdownMenuSeparator from '#lib/components/ui/dropdown-menu/dropdown-menu-separator.svelte';
import { MENU_LABEL_CLASS } from '#lib/components/ui/dropdown-menu/dropdown-menu-styles.ts';
import { SUPPORT_HREF } from '#lib/config/support.ts';
import ReportAbuseModal from '#lib/features/abuse/components/report-abuse-modal.svelte';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import { isDashboardMode } from '#lib/features/dashboard/lib/dashboard-mode.ts';
import {
	SIDEBAR_MENU_CONTENT_CLASS,
	SIDEBAR_MENU_ITEM_CLASS,
} from '#lib/features/dashboard/lib/sidebar-constants.ts';
import { getDashboardMode } from '#lib/features/dashboard/state/dashboard-mode.svelte.ts';
import {
	DASHBOARD_ITEM_ICONS,
	getDashboardNavigation,
} from '#lib/features/dashboard/state/dashboard-navigation.svelte.ts';
import { getSidebar } from '#lib/features/dashboard/state/sidebar.svelte.ts';
import { Path, resolvePath } from '#lib/routing/paths.ts';
import SidebarAvatar from './sidebar-avatar.svelte';
import SidebarMenuTrigger from './sidebar-menu-trigger.svelte';

interface MenuLink {
	id: keyof typeof DASHBOARD_ITEM_ICONS;
	label: string;
	path: Path;
}

const ACCOUNT_LINKS: readonly MenuLink[] = [
	{ id: 'account', label: 'Profile', path: Path.ACCOUNT },
	{ id: 'accountSecurity', label: 'Security', path: Path.ACCOUNT_SECURITY },
	{ id: 'invitations', label: 'Invitations', path: Path.INVITATIONS },
];

const auth = getAuth();
const mode = getDashboardMode();
const navigation = getDashboardNavigation();
const sidebar = getSidebar();
const queryClient = useQueryClient();
const { abuseHref, docsHref } = getWebsiteLinks();
const { analytics } = getPublicConfig();
const modeLabelId = $props.id();
const accountLabelId = `${modeLabelId}-${ACCOUNT_GROUP_SUFFIX}`;
const helpLabelId = `${modeLabelId}-${HELP_GROUP_SUFFIX}`;
let reportingAbuse = $state(false);

const accountEmail = $derived(auth.user?.email?.trim() ?? '');
const accountName = $derived(
	auth.user?.name?.trim() || accountEmail || ACCOUNT_LABEL
);

function modeLabel(value: DashboardMode): string {
	return value === DashboardMode.Host && mode.startHosting
		? START_HOSTING_LABEL
		: MODE_LABELS[value];
}

function selectMode(value: string): void {
	if (isDashboardMode(value)) navigation.switchMode(value);
}

async function signOutOfAccount(): Promise<void> {
	try {
		await signOut(queryClient);
	} catch (error) {
		showApiError(error, SIGN_OUT_FAILED_MESSAGE);
	}
}
</script>

{#snippet pageLink(link: MenuLink)}
	{const Icon = $derived(DASHBOARD_ITEM_ICONS[link.id])}
	<DropdownMenuItem size={MENU_ITEM_SIZE} class={SIDEBAR_MENU_ITEM_CLASS}>
		{#snippet child({ props })}
			<a {...props} href={resolvePath(link.path)}>
				<Icon aria-hidden="true" />
				<span class={MENU_LABEL_CLASS}>{link.label}</span>
			</a>
		{/snippet}
	</DropdownMenuItem>
{/snippet}

<DropdownMenu>
	<SidebarMenuTrigger
		name={accountName}
		label={`${ACCOUNT_LABEL}, ${accountName}, ${MODE_LABELS[mode.current]} mode`}
	/>
	<DropdownMenuContent
		align={sidebar.collapsed ? MENU_COLLAPSED_ALIGN : MENU_ALIGN}
		side={sidebar.collapsed ? MENU_COLLAPSED_SIDE : MENU_SIDE}
		class={SIDEBAR_MENU_CONTENT_CLASS}
	>
		{#if accountEmail}
			<div class="flex min-w-0 items-center gap-2 px-2 py-1.5">
				<SidebarAvatar name={accountName} />
				<div class="flex min-w-0 flex-col">
					<span class="truncate font-medium text-(--text-primary) text-sm">
						{accountName}
					</span>
					{#if accountName !== accountEmail}
						<span class="truncate text-(--text-subtle) text-xs">
							{accountEmail}
						</span>
					{/if}
				</div>
			</div>
			<DropdownMenuSeparator />
		{/if}
		<DropdownMenuLabel id={modeLabelId}>{MODE_GROUP_LABEL}</DropdownMenuLabel>
		<DropdownMenuRadioGroup
			aria-labelledby={modeLabelId}
			value={mode.current}
			onValueChange={selectMode}
		>
			{#each MODE_ORDER as value (value)}
				{const ModeIcon = $derived(MODE_ICONS[value])}
				<DropdownMenuRadioItem
					{value}
					size={MENU_ITEM_SIZE}
					class={SIDEBAR_MENU_ITEM_CLASS}
				>
					<ModeIcon aria-hidden="true" />
					<span class={MENU_LABEL_CLASS}>{modeLabel(value)}</span>
				</DropdownMenuRadioItem>
			{/each}
		</DropdownMenuRadioGroup>
		<DropdownMenuSeparator />
		<DropdownMenuPrimitive.Group aria-labelledby={accountLabelId}>
			<DropdownMenuLabel id={accountLabelId}>{ACCOUNT_LABEL}</DropdownMenuLabel>
			{#each ACCOUNT_LINKS as link (link.id)}
				{@render pageLink(link)}
			{/each}
		</DropdownMenuPrimitive.Group>
		<DropdownMenuSeparator />
		<DropdownMenuPrimitive.Group aria-labelledby={helpLabelId}>
			<DropdownMenuLabel id={helpLabelId}>{HELP_GROUP_LABEL}</DropdownMenuLabel>
			<DropdownMenuItem size={MENU_ITEM_SIZE} class={SIDEBAR_MENU_ITEM_CLASS}>
				{#snippet child({ props })}
					<a
						{...props}
						href={docsHref}
						target={EXTERNAL_TARGET}
						rel={EXTERNAL_REL}
					>
						<BookOpen aria-hidden="true" />
						<span class={MENU_LABEL_CLASS}>Documentation</span>
					</a>
				{/snippet}
			</DropdownMenuItem>
			<DropdownMenuItem size={MENU_ITEM_SIZE} class={SIDEBAR_MENU_ITEM_CLASS}>
				{#snippet child({ props })}
					<a {...props} href={SUPPORT_HREF}>
						<LifeBuoy aria-hidden="true" />
						<span class={MENU_LABEL_CLASS}>Support</span>
					</a>
				{/snippet}
			</DropdownMenuItem>
			<DropdownMenuItem
				size={MENU_ITEM_SIZE}
				class={SIDEBAR_MENU_ITEM_CLASS}
				onSelect={() => {
					reportingAbuse = true;
				}}
			>
				<Flag aria-hidden="true" />
				<span class={MENU_LABEL_CLASS}>Report abuse</span>
			</DropdownMenuItem>
			{#if analytics}
				<DropdownMenuItem
					size={MENU_ITEM_SIZE}
					class={SIDEBAR_MENU_ITEM_CLASS}
					onSelect={openConsentSettings}
				>
					<Cookie aria-hidden="true" />
					<span class={MENU_LABEL_CLASS}>Cookie settings</span>
				</DropdownMenuItem>
			{/if}
		</DropdownMenuPrimitive.Group>
		<DropdownMenuSeparator />
		<DropdownMenuItem
			size={MENU_ITEM_SIZE}
			class={SIDEBAR_MENU_ITEM_CLASS}
			onSelect={() => void signOutOfAccount()}
		>
			<LogOut aria-hidden="true" />
			<span class={MENU_LABEL_CLASS}>Sign out</span>
		</DropdownMenuItem>
	</DropdownMenuContent>
</DropdownMenu>
<ReportAbuseModal
	open={reportingAbuse}
	{abuseHref}
	onClose={() => {
		reportingAbuse = false;
	}}
/>
