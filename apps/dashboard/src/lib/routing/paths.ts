/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { resolve } from '$app/paths';
import type { Path as Pathname, ResolvedPathname } from '$app/types';

export const Path = {
	LOGIN: 'login',
	SIGNUP: 'signup',
	DASHBOARD: '',
	DEVICE: 'device',
	SANDBOXES: 'sandboxes',
	LISTINGS: 'listings',
	LISTINGS_MINE: 'listings/mine',
	SNAPSHOTS: 'snapshots',
	MACHINES: 'machines',
	SECRETS: 'secrets',
	REGISTRIES: 'registries',
	VOLUMES: 'volumes',
	AUDIT: 'audit',
	MEMBERS: 'members',
	MEMBER_INVITATIONS: 'members/invitations',
	MEMBER_ROLES: 'members/roles',
	BILLING: 'billing',
	BILLING_FUNDING: 'billing/funding',
	BILLING_USAGE: 'billing/usage',
	BILLING_NETWORK: 'billing/network',
	BILLING_PAYMENTS: 'billing/payments',
	BILLING_ACTIVITY: 'billing/activity',
	BILLING_STATEMENTS: 'billing/statements',
	EARNINGS: 'earnings',
	EARNINGS_CLAIMS: 'earnings/claims',
	EARNINGS_NETWORK: 'earnings/network',
	EARNINGS_PAYOUTS: 'earnings/payouts',
	SETTINGS: 'settings',
	SETTINGS_DEFAULTS: 'settings/defaults',
	SETTINGS_LIMITS: 'settings/limits',
	SETTINGS_API_KEYS: 'settings/api-keys',
	INVITATIONS: 'invitations',
	ACCOUNT: 'account',
	ADMIN: 'admin',
	ADMIN_SETTINGS: 'admin/settings',
	ADMIN_ORGANIZATIONS: 'admin/organizations',
	ADMIN_USERS: 'admin/users',
	ADMIN_MACHINES: 'admin/machines',
	ADMIN_LISTINGS: 'admin/listings',
	ADMIN_EDGES: 'admin/edges',
	ADMIN_CUTOVERS: 'admin/cutovers',
} as const satisfies Record<string, Pathname>;

export type Path = (typeof Path)[keyof typeof Path];

export function resolvePath(path: Path): ResolvedPathname {
	return resolve(path as typeof Path.DASHBOARD);
}
