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
import { FOCUS_RING_CLASS } from '#lib/components/ui/chip/chip-chrome.ts';
import { cn } from '#lib/utils/utils.ts';

interface LegalLinkProps {
	href: string;
	children: Snippet;
}

let { href, children }: LegalLinkProps = $props();
</script>

<a
	{href}
	target="_blank"
	rel="noopener noreferrer"
	class={cn(
		'rounded-xs text-(--text-primary) underline underline-offset-2 outline-none hover-hover:decoration-2',
		FOCUS_RING_CLASS
	)}
	>{@render children()}</a
>
