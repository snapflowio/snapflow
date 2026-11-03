<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { Snippet } from 'svelte';
import {
	FloatingTooltipTracker,
	setTooltip,
} from './floating-tooltip.svelte.ts';

interface TooltipRootProps {
	children: Snippet;
	preferAbove?: boolean;
}

let { children, preferAbove = false }: TooltipRootProps = $props();
const contentId = $props.id();

setTooltip(new FloatingTooltipTracker(contentId, () => preferAbove));
</script>

{@render children()}
