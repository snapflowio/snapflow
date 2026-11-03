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
import Avatar from '#lib/components/ui/avatar/avatar.svelte';
import AvatarFallback from '#lib/components/ui/avatar/avatar-fallback.svelte';
import OverflowText from '#lib/components/ui/overflow/overflow-text.svelte';

interface MemberRowProps {
	name: string;
	email: string;
	status: string;
	roleControl?: Snippet;
	menu?: Snippet;
}

let { name, email, status, roleControl, menu }: MemberRowProps = $props();

const initial = $derived((name || email).charAt(0).toUpperCase() || '?');
</script>

<div class="flex items-center gap-2.5 p-2">
	<Avatar size="xs">
		<AvatarFallback class="text-[8px] leading-none">{initial}</AvatarFallback>
	</Avatar>
	<OverflowText text={email} class="flex-1 text-(--text-body) text-sm" />
	<span class="shrink-0 text-(--text-muted) text-caption">{status}</span>
	{@render roleControl?.()}
	{@render menu?.()}
</div>
