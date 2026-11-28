/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Activity from '@lucide/svelte/icons/activity';
import Calculator from '@lucide/svelte/icons/calculator';
import Cpu from '@lucide/svelte/icons/cpu';
import Database from '@lucide/svelte/icons/database';
import Gauge from '@lucide/svelte/icons/gauge';
import HandCoins from '@lucide/svelte/icons/hand-coins';
import History from '@lucide/svelte/icons/history';
import IdCard from '@lucide/svelte/icons/id-card';
import ImageUp from '@lucide/svelte/icons/image';
import Key from '@lucide/svelte/icons/key';
import KeyRound from '@lucide/svelte/icons/key-round';
import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
import Mail from '@lucide/svelte/icons/mail';
import ReceiptText from '@lucide/svelte/icons/receipt-text';
import RefreshCw from '@lucide/svelte/icons/refresh-cw';
import ServerIcon from '@lucide/svelte/icons/server';
import Settings from '@lucide/svelte/icons/settings';
import ShieldAlert from '@lucide/svelte/icons/shield-alert';
import ShieldCheck from '@lucide/svelte/icons/shield-check';
import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
import User from '@lucide/svelte/icons/user';
import Users from '@lucide/svelte/icons/users';
import WalletIcon from '@lucide/svelte/icons/wallet';
import Webhook from '@lucide/svelte/icons/webhook';
import { createContext } from 'svelte';
import Connections from '#lib/components/icons/connections.svelte';
import Credit from '#lib/components/icons/credit.svelte';
import HexSimple from '#lib/components/icons/hex-simple.svelte';
import type { IconComponent } from '#lib/components/icons/icon-component.ts';
import TerminalWindow from '#lib/components/icons/terminal-window.svelte';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import { DashboardMode } from '#lib/features/dashboard/lib/dashboard-mode.ts';
import { getDashboardMode } from '#lib/features/dashboard/state/dashboard-mode.svelte.ts';
import type { OrganizationPermission as OrganizationPermissionGrant } from '#lib/features/organizations/lib/organization-permission.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { Path, resolvePath } from '#lib/routing/paths.ts';
import { isRoutePathActive } from '#lib/routing/router-path.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';

export const SidebarArea = {
	Main: 'main',
	Settings: 'settings',
	Admin: 'admin',
} as const;

export type SidebarArea = (typeof SidebarArea)[keyof typeof SidebarArea];

const deployNavigationGroups = [
	{
		id: 'compute',
		label: 'Compute',
		items: [
			{ id: 'sandboxes', label: 'Sandboxes', path: Path.SANDBOXES },
			{ id: 'snapshots', label: 'Snapshots', path: Path.SNAPSHOTS },
			{ id: 'volumes', label: 'Volumes', path: Path.VOLUMES },
			{ id: 'listings', label: 'Marketplace', path: Path.LISTINGS },
		],
	},
	{
		id: 'configuration',
		label: 'Configuration',
		items: [
			{ id: 'registries', label: 'Registries', path: Path.REGISTRIES },
			{ id: 'secrets', label: 'Secrets', path: Path.SECRETS },
		],
	},
] as const;

const paymentsGroup = {
	id: 'payments',
	label: null,
	items: [{ id: 'billing', label: 'Billing', path: Path.BILLING }],
} as const;

const hostNavigationGroups = [
	{
		id: 'hosting',
		label: 'Hosting',
		items: [
			{ id: 'machines', label: 'Machines', path: Path.MACHINES },
			{ id: 'earnings', label: 'Earnings', path: Path.EARNINGS },
			{ id: 'hostPricing', label: 'Pricing', path: Path.HOST_PRICING },
		],
	},
] as const;

const sharedUnlistedGroups = [
	{
		id: 'organizationPages',
		label: 'Organization',
		items: [{ id: 'wallet', label: 'Wallet', path: Path.BILLING_WALLET }],
	},
] as const;

const billingPaneGroups = [
	{
		id: 'billingPages',
		label: null,
		items: [
			{ id: 'billingOverview', label: 'Overview', path: Path.BILLING },
			{ id: 'billingUsage', label: 'Usage', path: Path.BILLING_USAGE },
			{ id: 'billingHistory', label: 'History', path: Path.BILLING_HISTORY },
			{ id: 'wallet', label: 'Wallet', path: Path.BILLING_WALLET },
		],
	},
] as const;

const settingsNavigationGroups = [
	{
		id: 'settingsAccount',
		label: 'Account',
		items: [
			{ id: 'account', label: 'Profile', path: Path.ACCOUNT },
			{ id: 'accountSecurity', label: 'Security', path: Path.ACCOUNT_SECURITY },
			{ id: 'invitations', label: 'Invitations', path: Path.INVITATIONS },
		],
	},
	{
		id: 'settingsOrganization',
		label: 'Organization',
		items: [
			{ id: 'settings', label: 'General', path: Path.SETTINGS },
			{ id: 'members', label: 'Members', path: Path.MEMBERS },
			{
				id: 'settingsApiKeys',
				label: 'API keys',
				path: Path.SETTINGS_API_KEYS,
			},
			{
				id: 'settingsWebhooks',
				label: 'Webhooks',
				path: Path.SETTINGS_WEBHOOKS,
			},
			{
				id: 'settingsDefaults',
				label: 'Defaults',
				path: Path.SETTINGS_DEFAULTS,
			},
			{ id: 'settingsLimits', label: 'Limits', path: Path.SETTINGS_LIMITS },
			{
				id: 'settingsBilling',
				label: 'Billing details',
				path: Path.SETTINGS_BILLING,
			},
			{ id: 'audit', label: 'Audit log', path: Path.AUDIT },
			{ id: 'hostProfile', label: 'Host profile', path: Path.HOST_PROFILE },
		],
	},
] as const;

const adminNavigationGroups = [
	{
		id: 'adminPlatform',
		label: 'Platform',
		items: [
			{
				id: 'adminSettings',
				label: 'Settings',
				path: Path.ADMIN_SETTINGS,
			},
		],
	},
	{
		id: 'adminTenants',
		label: 'Tenants',
		items: [
			{
				id: 'adminOrganizations',
				label: 'Organizations',
				path: Path.ADMIN_ORGANIZATIONS,
			},
			{ id: 'adminUsers', label: 'Users', path: Path.ADMIN_USERS },
			{ id: 'adminAbuse', label: 'Abuse', path: Path.ADMIN_ABUSE },
			{ id: 'adminRefunds', label: 'Refunds', path: Path.ADMIN_REFUNDS },
		],
	},
	{
		id: 'adminInfrastructure',
		label: 'Infrastructure',
		items: [
			{ id: 'adminMachines', label: 'Machines', path: Path.ADMIN_MACHINES },
			{ id: 'adminListings', label: 'Listings', path: Path.ADMIN_LISTINGS },
			{ id: 'adminEdges', label: 'Edges', path: Path.ADMIN_EDGES },
			{
				id: 'adminCutovers',
				label: 'Edge cutovers',
				path: Path.ADMIN_CUTOVERS,
			},
		],
	},
] as const;

const AREA_PARENTS = {
	settings: { id: 'settingsArea', label: 'Settings' },
	admin: { id: 'adminArea', label: 'Admin' },
} as const;

const AREA_PARENT_IDS: ReadonlySet<string> = new Set(
	Object.values(AREA_PARENTS).map((parent) => parent.id)
);

const BILLING_ITEM_ID = 'billing';

const MODE_NAVIGATION_GROUPS: Record<
	DashboardMode,
	readonly DashboardNavigationGroup[]
> = {
	[DashboardMode.Deploy]: deployNavigationGroups,
	[DashboardMode.Host]: hostNavigationGroups,
};

const MODE_UNLISTED_GROUPS: Record<
	DashboardMode,
	readonly DashboardNavigationGroup[]
> = {
	[DashboardMode.Deploy]: [paymentsGroup],
	[DashboardMode.Host]: [],
};

const MODE_LISTED_GROUPS: Record<
	DashboardMode,
	readonly DashboardNavigationGroup[]
> = {
	[DashboardMode.Deploy]: [...deployNavigationGroups, paymentsGroup],
	[DashboardMode.Host]: hostNavigationGroups,
};

interface ModeRoute {
	path: Path;
	mode: DashboardMode | null;
}

const MODE_ROUTES: readonly ModeRoute[] = [
	...Object.values(DashboardMode).flatMap((mode) =>
		[...MODE_NAVIGATION_GROUPS[mode], ...MODE_UNLISTED_GROUPS[mode]].flatMap(
			(group) => group.items.map((item) => ({ path: item.path, mode }))
		)
	),
	...sharedUnlistedGroups.flatMap((group) =>
		group.items.map((item) => ({ path: item.path, mode: null }))
	),
];

export function routeMode(pathname: string): DashboardMode | null {
	return (
		MODE_ROUTES.filter((route) =>
			isRoutePathActive(pathname, resolvePath(route.path))
		).toSorted((left, right) => right.path.length - left.path.length)[0]
			?.mode ?? null
	);
}

const EXACT_ACTIVE_PATHS: ReadonlySet<string> = new Set([
	Path.SETTINGS,
	Path.ACCOUNT,
]);

type DashboardNavigationGroup =
	| (typeof deployNavigationGroups)[number]
	| typeof paymentsGroup
	| (typeof hostNavigationGroups)[number]
	| (typeof sharedUnlistedGroups)[number]
	| (typeof billingPaneGroups)[number]
	| (typeof settingsNavigationGroups)[number];
type WorkspaceNavigationItem = DashboardNavigationGroup['items'][number];
type AdminNavigationGroup = (typeof adminNavigationGroups)[number];
type AdminNavigationItem = AdminNavigationGroup['items'][number];
type AreaParentId = (typeof AREA_PARENTS)[keyof typeof AREA_PARENTS]['id'];
type DashboardNavigationGroupId =
	| AdminNavigationGroup['id']
	| DashboardNavigationGroup['id'];
type DashboardNavigationItemId =
	| AdminNavigationItem['id']
	| WorkspaceNavigationItem['id']
	| AreaParentId;

export interface DashboardNavigationItemView {
	id: DashboardNavigationItemId;
	label: string;
	path: Path;
	subs?: readonly DashboardNavigationItemView[];
}

export interface DashboardNavigationGroupView {
	id: DashboardNavigationGroupId;
	items: readonly DashboardNavigationItemView[];
	label: string | null;
}

export interface DashboardNavigationAreaView {
	id: Exclude<SidebarArea, typeof SidebarArea.Main>;
	label: string;
	groups: readonly DashboardNavigationGroupView[];
}

const NO_NAVIGATION_GROUPS: readonly DashboardNavigationGroupView[] = [];

const BILLING_READ: OrganizationPermissionGrant = { billing: ['read'] };

const NAVIGATION_READ_PERMISSIONS: Partial<
	Record<WorkspaceNavigationItem['id'], OrganizationPermissionGrant>
> = {
	volumes: { volumes: ['read'] },
	secrets: { secrets: ['read'] },
	machines: { machines: ['read'] },
	hostPricing: { listings: ['read'] },
	audit: { audit_logs: ['read'] },
	billing: BILLING_READ,
	billingOverview: BILLING_READ,
	billingUsage: BILLING_READ,
	billingHistory: BILLING_READ,
	settingsBilling: BILLING_READ,
	earnings: { payouts: ['read'] },
	hostProfile: { listings: ['read'] },
	settingsWebhooks: { webhooks: ['read'] },
};

export const DASHBOARD_ITEM_ICONS = {
	sandboxes: TerminalWindow,
	listings: Cpu,
	snapshots: ImageUp,
	volumes: Database,
	registries: HexSimple,
	secrets: Key,
	machines: ServerIcon,
	hostPricing: Calculator,
	wallet: WalletIcon,
	audit: ShieldCheck,
	members: Users,
	billing: Credit,
	billingOverview: LayoutDashboard,
	billingUsage: Activity,
	billingHistory: History,
	earnings: HandCoins,
	hostProfile: IdCard,
	settings: Settings,
	settingsArea: Settings,
	account: User,
	accountSecurity: LockKeyhole,
	invitations: Mail,
	settingsDefaults: SlidersHorizontal,
	settingsLimits: Gauge,
	settingsBilling: ReceiptText,
	settingsApiKeys: KeyRound,
	settingsWebhooks: Webhook,
	adminArea: ShieldCheck,
	adminSettings: Settings,
	adminOrganizations: Users,
	adminUsers: User,
	adminMachines: ServerIcon,
	adminListings: Cpu,
	adminEdges: Connections,
	adminCutovers: RefreshCw,
	adminAbuse: ShieldAlert,
	adminRefunds: ReceiptText,
} satisfies Record<DashboardNavigationItemId, IconComponent>;

function longestMatch<T extends { path: Path }>(
	pathname: string,
	entries: readonly T[]
): T | undefined {
	return entries
		.filter((entry) => isRoutePathActive(pathname, resolvePath(entry.path)))
		.toSorted((left, right) => right.path.length - left.path.length)[0];
}

function areaItems(
	area: DashboardNavigationAreaView
): readonly { path: Path; area: DashboardNavigationAreaView }[] {
	return area.groups.flatMap((group) =>
		group.items.map((item) => ({ path: item.path, area }))
	);
}

export class DashboardNavigation {
	readonly #auth = getAuth();
	readonly permission = getOrganizationPermission();
	readonly mode = getDashboardMode();

	#permitted = (
		groups: readonly DashboardNavigationGroup[]
	): readonly DashboardNavigationGroupView[] =>
		groups
			.map((group) => ({
				id: group.id,
				label: group.label,
				items: group.items.filter((item: WorkspaceNavigationItem) => {
					const itemPermission = NAVIGATION_READ_PERMISSIONS[item.id];
					return !itemPermission || this.permission.can(itemPermission);
				}),
			}))
			.filter((group) => group.items.length > 0);

	readonly allPages: readonly DashboardNavigationGroupView[] = $derived(
		this.#permitted([
			...deployNavigationGroups,
			paymentsGroup,
			...hostNavigationGroups,
			...sharedUnlistedGroups,
		])
	);

	readonly settings: readonly DashboardNavigationGroupView[] = $derived(
		this.#permitted(settingsNavigationGroups)
	);

	readonly admin: readonly DashboardNavigationGroupView[] = $derived(
		this.#auth.isAdmin ? adminNavigationGroups : NO_NAVIGATION_GROUPS
	);

	readonly #billingSubs: readonly DashboardNavigationItemView[] = $derived(
		this.#permitted(billingPaneGroups).flatMap((group) => group.items)
	);

	readonly areas: readonly DashboardNavigationAreaView[] = $derived(
		[
			{
				id: SidebarArea.Settings,
				label: AREA_PARENTS.settings.label,
				groups: this.settings,
			},
			{
				id: SidebarArea.Admin,
				label: AREA_PARENTS.admin.label,
				groups: this.admin,
			},
		].filter((area) => area.groups.length > 0)
	);

	readonly #areaParents: readonly DashboardNavigationItemView[] = $derived(
		this.areas.flatMap((area) => {
			const first = area.groups[0]?.items[0];
			if (!first) return [];
			return [{ ...AREA_PARENTS[area.id], path: first.path }];
		})
	);

	readonly top: readonly DashboardNavigationItemView[] = $derived([
		...this.#permitted(MODE_LISTED_GROUPS[this.mode.current]).flatMap((group) =>
			group.items.map((item) =>
				item.id === BILLING_ITEM_ID && this.#billingSubs.length > 0
					? { ...item, subs: this.#billingSubs }
					: item
			)
		),
		...this.#areaParents,
	]);

	readonly area: DashboardNavigationAreaView | null = $derived(
		longestMatch(page.url.pathname, this.areas.flatMap(areaItems))?.area ?? null
	);

	readonly #activePath: Path | undefined = $derived(
		longestMatch(
			page.url.pathname,
			this.area
				? this.area.groups.flatMap((group) => group.items)
				: this.top.filter((item) => !AREA_PARENT_IDS.has(item.id))
		)?.path
	);

	isActive = (item: DashboardNavigationItemView): boolean =>
		item.path === this.#activePath;

	activeSub = (
		item: DashboardNavigationItemView
	): DashboardNavigationItemView | undefined =>
		item.subs ? longestMatch(page.url.pathname, item.subs) : undefined;

	switchMode = (next: DashboardMode): void => {
		const routed = routeMode(page.url.pathname);
		const startHosting = next === DashboardMode.Host && this.mode.startHosting;
		this.mode.set(next);
		if (startHosting || (routed !== null && routed !== next)) {
			void goto(this.modeLanding(next));
		}
	};

	modeLanding = (next: DashboardMode): string => {
		if (next === DashboardMode.Deploy) return resolve(Path.SANDBOXES);
		return resolve(this.mode.startHosting ? Path.MACHINES_ADD : Path.MACHINES);
	};

	pageAt = (pathname: string): DashboardNavigationItemView | undefined =>
		[...this.allPages, ...this.settings, ...this.admin]
			.flatMap((group): readonly DashboardNavigationItemView[] => group.items)
			.filter((item) =>
				isRoutePathActive(
					pathname,
					resolvePath(item.path),
					EXACT_ACTIVE_PATHS.has(item.path)
				)
			)
			.toSorted((left, right) => right.path.length - left.path.length)[0];
}

export const [getDashboardNavigation, setDashboardNavigation] =
	createContext<DashboardNavigation>();
