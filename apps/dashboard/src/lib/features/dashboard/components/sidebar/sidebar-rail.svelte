<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const RAIL_LABEL = 'Toggle sidebar';
const RAIL_TAB_INDEX = -1;
</script>

<script lang="ts">
import { SIDEBAR_RAIL_CLASS } from '#lib/features/dashboard/lib/sidebar-constants.ts';
import { getSidebar } from '#lib/features/dashboard/state/sidebar.svelte.ts';

const sidebar = getSidebar();
</script>

<button
	type="button"
	aria-label={RAIL_LABEL}
	title={RAIL_LABEL}
	tabindex={RAIL_TAB_INDEX}
	data-state={sidebar.state}
	class={SIDEBAR_RAIL_CLASS}
	onclick={sidebar.toggle}
></button>
