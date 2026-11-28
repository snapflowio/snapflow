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

const SETTINGS_TAB_PARAM = 'tab';

export const AdminSettingsTab = {
	General: 'general',
	Marketplace: 'marketplace',
	Network: 'network',
	Machines: 'machines',
	Operations: 'operations',
} as const;

export type AdminSettingsTab =
	(typeof AdminSettingsTab)[keyof typeof AdminSettingsTab];

const SETTINGS_TABS = [
	{ value: AdminSettingsTab.General, label: 'General' },
	{ value: AdminSettingsTab.Marketplace, label: 'Marketplace' },
	{ value: AdminSettingsTab.Network, label: 'Network' },
	{ value: AdminSettingsTab.Machines, label: 'Machines' },
	{ value: AdminSettingsTab.Operations, label: 'Operations' },
] as const satisfies readonly { value: AdminSettingsTab; label: string }[];

export const adminSettingsSearchSchema = z.object({
	[SETTINGS_TAB_PARAM]: z
		.enum([
			AdminSettingsTab.General,
			AdminSettingsTab.Marketplace,
			AdminSettingsTab.Network,
			AdminSettingsTab.Machines,
			AdminSettingsTab.Operations,
		])
		.catch(AdminSettingsTab.General),
});

function adminSettingsTabHref(tab: AdminSettingsTab): string {
	const base = resolve(Path.ADMIN_SETTINGS);
	if (tab === AdminSettingsTab.General) return base;
	return `${base}?${new URLSearchParams({ [SETTINGS_TAB_PARAM]: tab }).toString()}`;
}

export function adminSettingsTabs(active: AdminSettingsTab): ResourceTab[] {
	return SETTINGS_TABS.map((tab) => ({
		label: tab.label,
		href: adminSettingsTabHref(tab.value),
		active: tab.value === active,
	}));
}
