/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Building from '@lucide/svelte/icons/building-2';
import Cpu from '@lucide/svelte/icons/cpu';
import Database from '@lucide/svelte/icons/database';
import Gauge from '@lucide/svelte/icons/gauge';
import HandCoins from '@lucide/svelte/icons/hand-coins';
import ImageUp from '@lucide/svelte/icons/image';
import Key from '@lucide/svelte/icons/key';
import KeyRound from '@lucide/svelte/icons/key-round';
import Mail from '@lucide/svelte/icons/mail';
import RefreshCw from '@lucide/svelte/icons/refresh-cw';
import ServerIcon from '@lucide/svelte/icons/server';
import Settings from '@lucide/svelte/icons/settings';
import ShieldCheck from '@lucide/svelte/icons/shield-check';
import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
import User from '@lucide/svelte/icons/user';
import Users from '@lucide/svelte/icons/users';
import { createContext } from 'svelte';
import Connections from '#lib/components/icons/connections.svelte';
import Credit from '#lib/components/icons/credit.svelte';
import HexSimple from '#lib/components/icons/hex-simple.svelte';
import type { IconComponent } from '#lib/components/icons/icon-component.ts';
import TerminalWindow from '#lib/components/icons/terminal-window.svelte';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import type { OrganizationPermission as OrganizationPermissionGrant } from '#lib/features/organizations/lib/organization-permission.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { Path, resolvePath } from '#lib/routing/paths.ts';
import { isRoutePathActive } from '#lib/routing/router-path.ts';
import { resolve } from '$app/paths';
import { page } from '$app/state';

const dashboardNavigationGroups = [
	{
		id: 'compute',
		label: 'Compute',
		items: [
			{ id: 'sandboxes', label: 'Sandboxes', path: Path.SANDBOXES },
			{ id: 'listings', label: 'Listings', path: Path.LISTINGS },
			{ id: 'snapshots', label: 'Snapshots', path: Path.SNAPSHOTS },
			{ id: 'volumes', label: 'Volumes', path: Path.VOLUMES },
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
	{
		id: 'infrastructure',
		label: 'Infrastructure',
		items: [{ id: 'machines', label: 'Machines', path: Path.MACHINES }],
	},
	{
		id: 'governance',
		label: 'Governance',
		items: [{ id: 'audit', label: 'Audit logs', path: Path.AUDIT }],
	},
	{
		id: 'organization',
		label: 'Organization',
		items: [
			{ id: 'billing', label: 'Billing', path: Path.BILLING },
			{ id: 'earnings', label: 'Earnings', path: Path.EARNINGS },
		],
	},
] as const;

const settingsNavigationGroups = [
	{
		id: 'settingsAccount',
		label: 'Account',
		items: [
			{ id: 'account', label: 'Account', path: Path.ACCOUNT },
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
				id: 'settingsDefaults',
				label: 'Defaults',
				path: Path.SETTINGS_DEFAULTS,
			},
			{ id: 'settingsLimits', label: 'Limits', path: Path.SETTINGS_LIMITS },
			{
				id: 'settingsApiKeys',
				label: 'API keys',
				path: Path.SETTINGS_API_KEYS,
			},
		],
	},
] as const;

const settingsAdminGroup = {
	id: 'settingsAdmin',
	label: 'Admin',
	items: [
		{ id: 'adminArea', label: 'Platform admin', path: Path.ADMIN_SETTINGS },
	],
} as const;

const EXACT_ACTIVE_PATHS: ReadonlySet<string> = new Set([Path.SETTINGS]);

const SETTINGS_ROUTE_PATHS = [
	Path.SETTINGS,
	Path.ACCOUNT,
	Path.MEMBERS,
	Path.INVITATIONS,
] as const;

type DashboardNavigationGroup =
	| (typeof dashboardNavigationGroups)[number]
	| (typeof settingsNavigationGroups)[number]
	| typeof settingsAdminGroup;
type WorkspaceNavigationItem = DashboardNavigationGroup['items'][number];
type AdminNavigationGroup = (typeof adminNavigationGroups)[number];
type AdminNavigationItem = AdminNavigationGroup['items'][number];
export type DashboardNavigationGroupId =
	| AdminNavigationGroup['id']
	| DashboardNavigationGroup['id'];
export type DashboardNavigationItemId =
	| AdminNavigationItem['id']
	| WorkspaceNavigationItem['id'];
export type DashboardNavigationPath =
	| AdminNavigationItem['path']
	| WorkspaceNavigationItem['path'];

export interface DashboardNavigationGroupView {
	id: DashboardNavigationGroupId;
	items: readonly {
		id: DashboardNavigationItemId;
		label: string;
		path: DashboardNavigationPath;
	}[];
	label: string;
}

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

const NO_NAVIGATION_GROUPS: readonly AdminNavigationGroup[] = [];

const NAVIGATION_READ_PERMISSIONS: Partial<
	Record<WorkspaceNavigationItem['id'], OrganizationPermissionGrant>
> = {
	volumes: { volumes: ['read'] },
	secrets: { secrets: ['read'] },
	machines: { machines: ['read'] },
	audit: { audit_logs: ['read'] },
	billing: { billing: ['read'] },
	earnings: { payouts: ['read'] },
};

export const DASHBOARD_GROUP_ICONS = {
	compute: TerminalWindow,
	configuration: HexSimple,
	infrastructure: ServerIcon,
	governance: ShieldCheck,
	organization: Settings,
	settingsAccount: User,
	settingsOrganization: Building,
	settingsAdmin: ShieldCheck,
	adminPlatform: Settings,
	adminTenants: Users,
	adminInfrastructure: ServerIcon,
} satisfies Record<DashboardNavigationGroupId, IconComponent>;

export const DASHBOARD_ITEM_ICONS = {
	sandboxes: TerminalWindow,
	listings: Cpu,
	snapshots: ImageUp,
	volumes: Database,
	registries: HexSimple,
	secrets: Key,
	machines: ServerIcon,
	audit: ShieldCheck,
	members: Users,
	billing: Credit,
	earnings: HandCoins,
	settings: Settings,
	account: User,
	invitations: Mail,
	settingsDefaults: SlidersHorizontal,
	settingsLimits: Gauge,
	settingsApiKeys: KeyRound,
	adminArea: ShieldCheck,
	adminSettings: Settings,
	adminOrganizations: Users,
	adminUsers: User,
	adminMachines: ServerIcon,
	adminListings: Cpu,
	adminEdges: Connections,
	adminCutovers: RefreshCw,
} satisfies Record<DashboardNavigationItemId, IconComponent>;

export class DashboardNavigation {
	readonly #auth = getAuth();
	readonly permission = getOrganizationPermission();

	#permitted = (
		groups: readonly DashboardNavigationGroup[]
	): readonly DashboardNavigationGroupView[] =>
		groups
			.map((group) => ({
				...group,
				items: group.items.filter((item: WorkspaceNavigationItem) => {
					const itemPermission = NAVIGATION_READ_PERMISSIONS[item.id];
					return !itemPermission || this.permission.can(itemPermission);
				}),
			}))
			.filter((group) => group.items.length > 0);

	readonly workspace: readonly DashboardNavigationGroupView[] = $derived(
		this.#permitted(dashboardNavigationGroups)
	);

	readonly settings: readonly DashboardNavigationGroupView[] = $derived(
		this.#permitted(
			this.#auth.isAdmin
				? [...settingsNavigationGroups, settingsAdminGroup]
				: settingsNavigationGroups
		)
	);

	readonly inSettings = $derived(
		SETTINGS_ROUTE_PATHS.some((path) =>
			isRoutePathActive(page.url.pathname, resolvePath(path))
		)
	);

	returnUrl = $state<string>(resolve(Path.SANDBOXES));

	rememberReturnUrl = (url: URL): void => {
		if (
			SETTINGS_ROUTE_PATHS.some((path) =>
				isRoutePathActive(url.pathname, resolvePath(path))
			)
		) {
			return;
		}
		this.returnUrl = `${url.pathname}${url.search}`;
	};

	readonly admin: readonly AdminNavigationGroup[] = $derived(
		this.#auth.isAdmin ? adminNavigationGroups : NO_NAVIGATION_GROUPS
	);

	readonly inAdminArea = $derived(
		isRoutePathActive(page.url.pathname, resolve(Path.ADMIN))
	);

	readonly primary = $derived(
		this.inAdminArea ? [] : (this.workspace[0]?.items ?? [])
	);

	readonly sections: readonly DashboardNavigationGroupView[] = $derived(
		this.inAdminArea ? this.admin : this.workspace.slice(1)
	);

	isActive = (path: DashboardNavigationPath): boolean =>
		isRoutePathActive(
			page.url.pathname,
			resolvePath(path),
			EXACT_ACTIVE_PATHS.has(path)
		);
}

export const [getDashboardNavigation, setDashboardNavigation] =
	createContext<DashboardNavigation>();
