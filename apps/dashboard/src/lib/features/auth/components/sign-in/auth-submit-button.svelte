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
import Chip from '#lib/components/ui/chip/chip.svelte';
import { AUTH_BUTTON_CLASS } from '#lib/features/auth/lib/sign-in/auth-form-styles.ts';

interface AuthSubmitButtonProps {
	children: Snippet;
	loading?: boolean;
	disabled?: boolean;
	type?: 'submit' | 'button';
	onclick?: () => void;
}

let {
	children,
	loading = false,
	disabled = false,
	type = 'submit',
	onclick,
}: AuthSubmitButtonProps = $props();
</script>

<Chip
	variant="primary"
	{type}
	{onclick}
	{loading}
	{disabled}
	fullWidth
	class={AUTH_BUTTON_CLASS}
>
	{@render children()}
</Chip>
