<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ChipInput, {
	type ChipInputProps,
} from '#lib/components/ui/chip/chip-input.svelte';
import { AUTH_CONTROL_HEIGHT } from '#lib/features/auth/lib/sign-in/auth-form-styles.ts';
import { cn } from '#lib/utils/utils.ts';

let {
	class: className,
	value = $bindable(),
	ref = $bindable(null),
	...props
}: ChipInputProps = $props();
</script>

<ChipInput
	bind:value
	bind:ref
	class={cn(AUTH_CONTROL_HEIGHT, className)}
	{...props}
/>
