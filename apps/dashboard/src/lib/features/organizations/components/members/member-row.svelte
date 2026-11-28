<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import IdentityTile from '#lib/components/ui/avatar/identity-tile.svelte';
import Badge from '#lib/components/ui/badge.svelte';

interface MemberRowProps {
	name: string;
	email: string;
	self?: boolean;
}

let { name, email, self = false }: MemberRowProps = $props();
</script>

<div class="flex min-w-0 items-center gap-2">
	<IdentityTile {name} size="sm" />
	<div class="flex min-w-0 flex-col">
		<span class="flex min-w-0 items-center gap-2">
			<span class="truncate text-(--text-primary) text-sm">{name}</span>
			{#if self}
				<Badge size="pill">You</Badge>
			{/if}
		</span>
		{#if email !== name}
			<span class="truncate text-(--text-muted) text-xs">{email}</span>
		{/if}
	</div>
</div>
