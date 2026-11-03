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
import { AUTH_TEXT_LINK_CLASS } from '#lib/features/auth/lib/sign-in/auth-form-styles.ts';
import { cn } from '#lib/utils/utils.ts';

interface AuthTextLinkProps {
	children: Snippet;
	href?: string;
	onclick?: () => void;
	external?: boolean;
	disabled?: boolean;
	class?: ClassValue;
}

let {
	children,
	href,
	onclick,
	external = false,
	disabled = false,
	class: className,
}: AuthTextLinkProps = $props();
</script>

{#if href !== undefined}
	<a
		{href}
		{onclick}
		target={external ? '_blank' : undefined}
		rel={external ? 'noopener noreferrer' : undefined}
		class={cn(AUTH_TEXT_LINK_CLASS, className)}
	>
		{@render children()}
	</a>
{:else}
	<button
		type="button"
		{onclick}
		{disabled}
		class={cn(AUTH_TEXT_LINK_CLASS, className)}
	>
		{@render children()}
	</button>
{/if}
