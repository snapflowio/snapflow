<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const COLLAPSE_LABEL = 'Collapse sidebar';
const EXPAND_LABEL = 'Expand sidebar';
</script>

<script lang="ts">
import PanelLeft from '@lucide/svelte/icons/panel-left';
import IconButton from '#lib/components/ui/icon-button.svelte';
import {
	SIDEBAR_KEYSHORTCUTS,
	SIDEBAR_NAVIGATION_ID,
	SIDEBAR_SHORTCUT,
} from '#lib/features/dashboard/lib/sidebar-constants.ts';
import { getSidebar } from '#lib/features/dashboard/state/sidebar.svelte.ts';

const sidebar = getSidebar();
</script>

<IconButton
	variant="quiet"
	size="md"
	label={sidebar.collapsed ? EXPAND_LABEL : COLLAPSE_LABEL}
	icon={PanelLeft}
	shortcut={SIDEBAR_SHORTCUT}
	aria-keyshortcuts={SIDEBAR_KEYSHORTCUTS}
	aria-expanded={!sidebar.collapsed}
	aria-controls={SIDEBAR_NAVIGATION_ID}
	onclick={sidebar.toggle}
/>
