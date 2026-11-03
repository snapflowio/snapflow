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
import Badge from '#lib/components/ui/badge.svelte';
import type { LoginMethod } from '#lib/features/auth/lib/sign-in/login-method.ts';

interface AuthLastUsedBadgeProps {
	method: LoginMethod;
}

let { method }: AuthLastUsedBadgeProps = $props();

const lastUsed = $derived(isLastUsedLoginMethod(method));
</script>

{#if lastUsed}
	<Badge size="sm" variant="blue">Last used</Badge>
{/if}
