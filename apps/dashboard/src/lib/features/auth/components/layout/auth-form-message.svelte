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
import { cn } from '#lib/utils/utils.ts';

interface AuthFormMessageProps {
	type: 'error' | 'success';
	align?: 'left' | 'center';
	children: Snippet;
}

let { type, align = 'left', children }: AuthFormMessageProps = $props();
</script>

<div
	role={type === 'error' ? 'alert' : 'status'}
	aria-live="polite"
	class={cn(
		'space-y-1 text-caption',
		align === 'center' && 'text-center',
		type === 'error' ? 'text-(--text-error)' : 'text-brand'
	)}
>
	<p>{@render children()}</p>
</div>
