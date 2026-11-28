<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { Snippet } from 'svelte';
import type { HTMLInputAttributes } from 'svelte/elements';
import type { ChipIcon } from './chip-selection.ts';

export interface ChipInputProps extends Omit<HTMLInputAttributes, 'size'> {
	icon?: ChipIcon;
	startAdornment?: Snippet;
	endAdornment?: Snippet;
	error?: boolean;
	clearable?: boolean;
	onClear?: () => void;
	concealable?: boolean;
	ref?: HTMLInputElement | null;
}

export const CHIP_FIELD_FOCUS_CLASS =
	'has-[:focus-visible]:border-(--accent-fill) has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-(--accent-fill)/40';
</script>

<script lang="ts">
import Eye from '@lucide/svelte/icons/eye';
import EyeOff from '@lucide/svelte/icons/eye-off';
import X from '@lucide/svelte/icons/x';
import IconButton from '#lib/components/ui/icon-button.svelte';
import { cn } from '#lib/utils/utils.ts';
import {
	chipFieldSurfaceClass,
	chipFieldTextClass,
	DISABLED_CLASS,
} from './chip-chrome.ts';

let {
	class: className,
	icon: Icon,
	startAdornment,
	endAdornment,
	error: invalid,
	clearable = false,
	onClear,
	concealable = false,
	disabled,
	readonly,
	type = 'text',
	value = $bindable(),
	ref = $bindable(null),
	...rest
}: ChipInputProps = $props();

let revealed = $state(false);
const effectiveType = $derived(concealable && !revealed ? 'password' : type);
const showsClear = $derived(
	clearable &&
		!disabled &&
		!readonly &&
		value !== undefined &&
		value !== null &&
		String(value).length > 0
);

function clear(): void {
	value = '';
	onClear?.();
	if (ref) {
		ref.value = '';
		ref.dispatchEvent(new Event('input', { bubbles: true }));
		ref.focus();
	}
}
</script>

<div
	class={cn(
		'flex h-10 w-full items-center gap-2 px-3',
		chipFieldSurfaceClass,
		!disabled && !readonly && CHIP_FIELD_FOCUS_CLASS,
		invalid && 'border-(--text-error)/60',
		disabled && DISABLED_CLASS,
		className
	)}
>
	{#if Icon}
		<Icon class="size-4 shrink-0 text-(--text-icon)" />
	{/if}
	{@render startAdornment?.()}
	<input
		bind:this={ref}
		bind:value
		type={effectiveType}
		{disabled}
		{readonly}
		aria-invalid={invalid || undefined}
		autocomplete={concealable ? 'off' : undefined}
		class={[
			'h-full w-full min-w-0 bg-transparent read-only:cursor-default disabled:cursor-not-allowed',
			chipFieldTextClass,
		]}
		{...rest}
	>
	{#if showsClear}
		<IconButton label="Clear" icon={X} tooltip={false} onclick={clear} />
	{/if}
	{#if concealable}
		<IconButton
			label={revealed ? 'Hide value' : 'Show value'}
			icon={revealed ? EyeOff : Eye}
			aria-pressed={revealed}
			onclick={() => (revealed = !revealed)}
		/>
	{/if}
	{@render endAdornment?.()}
</div>
