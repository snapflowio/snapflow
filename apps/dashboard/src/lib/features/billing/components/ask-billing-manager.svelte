<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const ROLE_REQUIRED = 'Needs billing: manage';
</script>

<script lang="ts">
import Lock from '@lucide/svelte/icons/lock';
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';
</script>

<Tooltip content={ROLE_REQUIRED}>
	{#snippet child({ props })}
		<button
			{...props}
			type="button"
			class="inline-flex h-10 shrink-0 cursor-default items-center gap-1.5 rounded-full border border-border border-dashed px-4 text-(--text-muted) text-sm outline-none focus-visible:focus-ring"
		>
			<Lock class="size-3.5 text-(--text-icon)" />
			Ask a billing manager
		</button>
	{/snippet}
</Tooltip>
