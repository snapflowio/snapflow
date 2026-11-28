/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import * as z from 'zod';
import type { ResourceTab } from '#lib/components/resource/resource-tabs.svelte';
import { Path } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';

export const WALLET_TAB_PARAM = 'tab';

export const WalletTab = {
	Overview: 'overview',
	Funding: 'funding',
	Recovery: 'recovery',
	Activity: 'activity',
} as const;

export type WalletTab = (typeof WalletTab)[keyof typeof WalletTab];

const WALLET_TABS = [
	{ value: WalletTab.Overview, label: 'Overview' },
	{ value: WalletTab.Funding, label: 'Funding wallet' },
	{ value: WalletTab.Recovery, label: 'Recovery' },
	{ value: WalletTab.Activity, label: 'Activity' },
] as const satisfies readonly { value: WalletTab; label: string }[];

export const walletSearchSchema = z.object({
	[WALLET_TAB_PARAM]: z
		.enum([
			WalletTab.Overview,
			WalletTab.Funding,
			WalletTab.Recovery,
			WalletTab.Activity,
		])
		.catch(WalletTab.Overview),
});

export function walletTabHref(tab: WalletTab): string {
	const base = resolve(Path.BILLING_WALLET);
	if (tab === WalletTab.Overview) return base;
	return `${base}?${new URLSearchParams({ [WALLET_TAB_PARAM]: tab }).toString()}`;
}

export function walletTabs(active: WalletTab): ResourceTab[] {
	return WALLET_TABS.map((tab) => ({
		label: tab.label,
		href: walletTabHref(tab.value),
		active: tab.value === active,
	}));
}
