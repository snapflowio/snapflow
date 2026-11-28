<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { isLastUsedLoginMethod } from '#lib/api/auth/sign-in.ts';
import type { LoginMethod } from '#lib/features/auth/lib/sign-in/login-method.ts';
import { cn } from '#lib/utils/utils.ts';

interface AuthLastUsedBadgeProps {
	method: LoginMethod;
	floating?: boolean;
}

let { method, floating = false }: AuthLastUsedBadgeProps = $props();

const lastUsed = $derived(isLastUsedLoginMethod(method));
</script>

{#if lastUsed}
	<span
		class={cn(
			'whitespace-nowrap rounded-full border border-surface-6 bg-surface-1 px-2 py-0.5 font-normal text-(--text-muted) text-xs',
			floating && 'absolute -top-3 -right-2'
		)}
	>
		Last used
	</span>
{/if}
