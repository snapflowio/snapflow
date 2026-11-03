<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const RECENT_SANDBOX_LIMIT = 8;
</script>

<script lang="ts">
import { createQuery } from '@tanstack/svelte-query';
import { sandboxListQueryOptions } from '#lib/api/sandboxes/sandboxes.ts';
import type { IconComponent } from '#lib/components/icons/icon-component.ts';
import { SidebarHoverMenu } from '#lib/features/dashboard/state/sidebar-hover-menu.svelte.ts';
import { resolve } from '$app/paths';
import SidebarRailFlyout from './sidebar-rail-flyout.svelte';

interface SandboxesRailFlyoutProps {
	label: string;
	icon: IconComponent;
	href: string;
	active: boolean;
}

let { label, icon, href, active }: SandboxesRailFlyoutProps = $props();

const menu = new SidebarHoverMenu();
const sandboxes = createQuery(() => ({
	...sandboxListQueryOptions({ limit: RECENT_SANDBOX_LIMIT }),
	enabled: menu.open,
}));
const items = $derived(
	(sandboxes.data?.items ?? []).map((sandbox) => ({
		id: sandbox.id,
		label: sandbox.name,
		href: resolve('/(app)/(dashboard)/sandboxes/[sandboxId]', {
			sandboxId: sandbox.id,
		}),
	}))
);
</script>

<SidebarRailFlyout
	{label}
	{icon}
	{href}
	{active}
	{items}
	{menu}
	loading={sandboxes.isPending && menu.open}
	emptyLabel="No sandboxes yet"
/>
