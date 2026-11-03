<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { IconComponent } from '#lib/components/icons/icon-component.ts';
import { RESOURCE_TILE_CLASS } from '#lib/components/ui/chip/chip-chrome.ts';

interface CredentialDetailHeadingProps {
	icon: IconComponent;
	title: string;
	subtitle?: string;
}

let { icon: Icon, title, subtitle }: CredentialDetailHeadingProps = $props();
</script>

<div class="flex min-w-0 items-center gap-2.5">
	<div class={RESOURCE_TILE_CLASS}><Icon /></div>
	<div class="flex min-w-0 flex-col gap-px">
		<span class="truncate text-(--text-body) text-sm">{title}</span>
		{#if subtitle}
			<span class="truncate text-(--text-muted) text-caption">
				{subtitle}
			</span>
		{/if}
	</div>
</div>
