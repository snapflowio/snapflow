<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Cpu from '@lucide/svelte/icons/cpu';
import Gpu from '@lucide/svelte/icons/gpu';
import { RESOURCE_TILE_CLASS } from '#lib/components/ui/chip/chip-chrome.ts';

interface ListingTileProps {
	gpuCount: number;
}

let { gpuCount }: ListingTileProps = $props();
</script>

<div class={RESOURCE_TILE_CLASS} aria-hidden="true">
	{#if gpuCount > 0}
		<Gpu />
	{:else}
		<Cpu />
	{/if}
</div>
