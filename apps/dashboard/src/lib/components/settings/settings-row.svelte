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
import type { ClassValue } from 'svelte/elements';

export type SettingsRowLayout = 'inline' | 'split' | 'stacked';

export interface SettingsRowProps {
	label: string;
	description?: string;
	info?: string;
	for?: string;
	layout?: SettingsRowLayout;
	control?: Snippet<[string]>;
	children?: Snippet;
	disabledReason?: string | null;
	error?: string | null;
	class?: ClassValue;
}

const LAYOUT_CLASS: Record<SettingsRowLayout, string> = {
	inline:
		'flex min-h-8 flex-col gap-x-8 gap-y-3 @lg/settings-row:flex-row @lg/settings-row:items-center @lg/settings-row:justify-between',
	split:
		'flex flex-col gap-x-12 gap-y-3 @xl/settings-row:grid @xl/settings-row:grid-cols-[minmax(12rem,1fr)_minmax(14rem,1fr)] @xl/settings-row:items-start',
	stacked: 'flex flex-col gap-y-4',
};

const LABEL_CLASS: Record<SettingsRowLayout, string> = {
	inline: 'min-w-0 flex-1 @lg/settings-row:min-w-40',
	split: 'w-full @xl/settings-row:pt-2.5',
	stacked: '',
};

const CONTROL_CLASS: Record<SettingsRowLayout, string> = {
	inline:
		'flex min-w-0 flex-wrap items-center gap-2 @lg/settings-row:max-w-2/3 @lg/settings-row:shrink-0 @lg/settings-row:justify-end @lg/settings-row:text-right',
	split:
		'flex w-full min-w-0 items-center @xl/settings-row:min-h-10 @xl/settings-row:justify-end',
	stacked: 'min-w-0',
};
</script>

<script lang="ts">
import InfoTooltip from '#lib/components/page/info-tooltip.svelte';
import Label from '#lib/components/ui/label.svelte';
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';
import { cn } from '#lib/utils/utils.ts';

let {
	label,
	description,
	info,
	for: controlId,
	layout = 'inline',
	control,
	children,
	disabledReason,
	error: errorText,
	class: className,
}: SettingsRowProps = $props();

const generatedId = $props.id();
const messageId = `${generatedId}-message`;
const labelTarget = $derived(controlId ?? (control ? generatedId : undefined));
</script>

{#snippet controlSlot()}
	{#if control}
		{@render control(labelTarget ?? generatedId)}
	{:else}
		{@render children?.()}
	{/if}
{/snippet}

<div data-settings-row="" class={cn('@container/settings-row', className)}>
	<div class={LAYOUT_CLASS[layout]}>
		<div class={cn('flex min-w-0 flex-col gap-1', LABEL_CLASS[layout])}>
			<div class="flex min-w-0 items-center gap-1.5">
				{#if labelTarget}
					<Label for={labelTarget} class="leading-5">{label}</Label>
				{:else}
					<span class="font-medium text-(--text-primary) text-sm leading-5"
						>{label}</span
					>
				{/if}
				{#if info}
					<InfoTooltip content={info} />
				{/if}
			</div>
			{#if description}
				<p class="text-pretty text-(--text-muted) text-sm">{description}</p>
			{/if}
			{#if errorText}
				<p
					id={messageId}
					role="alert"
					class="font-medium text-(--text-error) text-sm"
				>
					{errorText}
				</p>
			{/if}
		</div>
		<div class={CONTROL_CLASS[layout]}>
			{#if disabledReason}
				<Tooltip content={disabledReason}>
					{#snippet child({ props })}
						<span
							{...props}
							class={cn(
								'inline-flex cursor-not-allowed',
								layout !== 'inline' && 'w-full'
							)}
						>
							{@render controlSlot()}
						</span>
					{/snippet}
				</Tooltip>
			{:else}
				{@render controlSlot()}
			{/if}
		</div>
	</div>
</div>
