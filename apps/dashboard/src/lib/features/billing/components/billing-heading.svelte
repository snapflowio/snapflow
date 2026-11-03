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
import type { IconComponent } from '#lib/components/icons/icon-component.ts';

interface BillingHeadingProps {
	icon: IconComponent;
	title: string;
	detail: string;
	trailing?: Snippet;
}

let { icon: Icon, title, detail, trailing }: BillingHeadingProps = $props();
</script>

<div class="flex items-center justify-between gap-3">
	<div class="flex min-w-0 items-center gap-2.5">
		<div
			class="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-bg"
		>
			<Icon class="size-5 text-(--text-icon)" />
		</div>
		<div class="flex min-w-0 flex-col">
			<span class="truncate text-(--text-body) text-sm tabular-nums">
				{title}
			</span>
			<span class="truncate text-(--text-muted) text-caption">{detail}</span>
		</div>
	</div>
	{@render trailing?.()}
</div>
