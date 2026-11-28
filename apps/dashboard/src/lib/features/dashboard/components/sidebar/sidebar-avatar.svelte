<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { ClassValue } from 'svelte/elements';

const WORD_SEPARATOR = /\s+/;

function initials(name: string): string {
	const words = name.trim().split(WORD_SEPARATOR).filter(Boolean);
	const first = words[0]?.charAt(0) ?? '';
	const last = words.length > 1 ? (words.at(-1)?.charAt(0) ?? '') : '';
	return `${first}${last}`.toUpperCase();
}

interface SidebarAvatarProps {
	name: string;
	class?: ClassValue;
}
</script>

<script lang="ts">
import { SIDEBAR_AVATAR_CLASS } from '#lib/features/dashboard/lib/sidebar-constants.ts';
import { cn } from '#lib/utils/utils.ts';

let { name, class: className }: SidebarAvatarProps = $props();
</script>

<i aria-hidden="true" class={cn(SIDEBAR_AVATAR_CLASS, className)}>
	{initials(name)}
</i>
