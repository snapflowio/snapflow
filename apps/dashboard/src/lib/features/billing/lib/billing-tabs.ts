/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ResourceTab } from '#lib/components/resource/resource-tabs.svelte';
import { Path } from '#lib/routing/paths.ts';
import { isRoutePathActive } from '#lib/routing/router-path.ts';
import { resolve } from '$app/paths';

type BillingTabPath =
	| typeof Path.BILLING
	| typeof Path.BILLING_USAGE
	| typeof Path.BILLING_NETWORK
	| typeof Path.BILLING_PAYMENTS
	| typeof Path.BILLING_ACTIVITY
	| typeof Path.BILLING_STATEMENTS
	| typeof Path.EARNINGS
	| typeof Path.EARNINGS_CHANNELS
	| typeof Path.EARNINGS_CLAIMS
	| typeof Path.EARNINGS_NETWORK
	| typeof Path.EARNINGS_PAYOUTS;

interface BillingTabDefinition {
	label: string;
	to: BillingTabPath;
	exact?: boolean;
}

const BILLING_TABS: readonly BillingTabDefinition[] = [
	{ label: 'Overview', to: Path.BILLING, exact: true },
	{ label: 'Usage', to: Path.BILLING_USAGE },
	{ label: 'Network transfer', to: Path.BILLING_NETWORK },
	{ label: 'Payments', to: Path.BILLING_PAYMENTS },
	{ label: 'Activity', to: Path.BILLING_ACTIVITY },
	{ label: 'Statements', to: Path.BILLING_STATEMENTS },
];

const EARNINGS_TABS: readonly BillingTabDefinition[] = [
	{ label: 'Overview', to: Path.EARNINGS, exact: true },
	{ label: 'Channels', to: Path.EARNINGS_CHANNELS },
	{ label: 'Claims', to: Path.EARNINGS_CLAIMS },
	{ label: 'Network transfer', to: Path.EARNINGS_NETWORK },
	{ label: 'Payout wallet', to: Path.EARNINGS_PAYOUTS },
];

function routeTabs(
	tabs: readonly BillingTabDefinition[],
	pathname: string
): ResourceTab[] {
	return tabs.map((tab) => {
		const href = resolve(tab.to);
		return {
			label: tab.label,
			href,
			active: isRoutePathActive(pathname, href, tab.exact),
		};
	});
}

export function billingTabs(pathname: string): ResourceTab[] {
	return routeTabs(BILLING_TABS, pathname);
}

export function earningsTabs(pathname: string): ResourceTab[] {
	return routeTabs(EARNINGS_TABS, pathname);
}
