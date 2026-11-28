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
import type { ClassValue } from 'svelte/elements';
import { cn } from '#lib/utils/utils.ts';
import { provideKeyValueList } from './key-value-list-context.ts';

interface KeyValueListProps {
	children: Snippet;
	framed?: boolean;
	review?: boolean;
	label?: string;
	class?: ClassValue;
}

let {
	children,
	framed = true,
	review = false,
	label,
	class: className,
}: KeyValueListProps = $props();

provideKeyValueList({
	get framed() {
		return framed;
	},
	get review() {
		return review;
	},
});
</script>

<dl
	aria-label={label}
	class={cn(
		'flex flex-col',
		review && '@container',
		framed &&
			'divide-y divide-border overflow-hidden rounded-2xl border border-border',
		className
	)}
>
	{@render children()}
</dl>
