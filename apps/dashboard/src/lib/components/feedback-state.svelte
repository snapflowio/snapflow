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
import type { HTMLAttributes } from 'svelte/elements';
import { SUPPORT_HREF } from '#lib/config/support.ts';

export type FeedbackTone = 'muted' | 'error';
export type FeedbackVariant = 'fill' | 'inline';

interface FeedbackStateProps
	extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'role'> {
	message?: string | Snippet;
	resource?: string;
	error?: unknown;
	children?: Snippet;
	action?: Snippet;
	tone?: FeedbackTone;
	variant?: FeedbackVariant;
	onRetry?: () => void;
	retrying?: boolean;
	bordered?: boolean;
}

const REQUEST_ID_PROPERTY = 'requestId';
const DEFAULT_RESOURCE = 'this page';
const SUPPORT_SUBJECT = 'Snapflow request';

function readRequestId(error: unknown): string | null {
	if (!error || typeof error !== 'object') return null;
	if (!(REQUEST_ID_PROPERTY in error)) return null;
	const value = (error as Record<typeof REQUEST_ID_PROPERTY, unknown>)[
		REQUEST_ID_PROPERTY
	];
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function supportHref(requestId: string | null): string {
	const subject = requestId
		? `${SUPPORT_SUBJECT} ${requestId}`
		: SUPPORT_SUBJECT;
	return `${SUPPORT_HREF}?subject=${encodeURIComponent(subject)}`;
}
</script>

<script lang="ts">
import CircleAlert from '@lucide/svelte/icons/circle-alert';
import { ICON_STROKE_WIDTH } from '#lib/components/icons/icon-component.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import CopyableText from '#lib/components/ui/clipboard/copyable-text.svelte';
import { cn } from '#lib/utils/utils.ts';

let {
	action,
	bordered = true,
	children,
	class: className,
	message,
	resource = DEFAULT_RESOURCE,
	error,
	onRetry,
	retrying = false,
	tone = 'muted',
	variant = 'fill',
	...props
}: FeedbackStateProps = $props();

const hasControls = $derived(Boolean(onRetry || action));
const requestId = $derived(readRequestId(error));
const errorTitle = $derived(
	typeof message === 'string' && message.length > 0
		? message
		: `Couldn't load ${resource}`
);
</script>

{#if tone === 'error'}
	<div
		{...props}
		role="alert"
		class={cn(
			'flex w-full min-w-0 flex-col',
			variant === 'fill' && 'self-stretch',
			className
		)}
	>
		<div
			class={bordered
				? 'grid w-full grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 rounded-2xl border border-border bg-surface-1 px-6 py-4'
				: 'flex w-full flex-col items-center gap-3 p-12 text-center'}
		>
			<CircleAlert
				class={cn(
					'shrink-0 text-(--text-error)',
					bordered ? 'size-4' : 'size-6'
				)}
				strokeWidth={bordered ? undefined : ICON_STROKE_WIDTH}
			/>
			<p
				class={cn(
					'text-pretty text-(--text-primary)',
					bordered ? 'font-medium text-sm' : 'max-w-md text-base'
				)}
			>
				{errorTitle}
			</p>
			<div
				class={cn(
					'flex flex-col gap-2 text-(--text-muted) text-sm',
					bordered ? 'col-start-2' : 'max-w-md items-center'
				)}
			>
				{#if typeof message === 'function'}
					<p class="text-pretty">{@render message()}</p>
				{/if}
				{@render children?.()}
				{#if requestId}
					<div class="w-full max-w-56">
						<CopyableText value={requestId} label="Copy request ID" />
					</div>
				{/if}
			</div>
			<div
				class={cn(
					'mt-4 flex gap-2',
					bordered
						? 'col-start-2 flex-col items-stretch sm:flex-row sm:items-center'
						: 'flex-wrap items-center justify-center'
				)}
			>
				{#if onRetry}
					<Chip
						variant="secondary"
						size="compact"
						loading={retrying}
						onclick={onRetry}
					>
						Try again
					</Chip>
				{/if}
				<Chip variant="ghost" size="compact" href={supportHref(requestId)}
					>Contact support</Chip
				>
				{@render action?.()}
			</div>
		</div>
	</div>
{:else}
	<div
		{...props}
		role="status"
		class={cn(
			'relative flex flex-col items-center justify-center text-center',
			variant === 'fill' ? 'min-h-40 gap-4 px-6 py-8' : 'gap-2 py-4',
			className
		)}
	>
		<p class="max-w-md text-pretty text-(--text-subtle) text-sm">
			{#if typeof message === 'string'}
				{message}
			{:else if message}
				{@render message()}
			{:else}
				{@render children?.()}
			{/if}
		</p>
		{#if hasControls}
			<div class="flex flex-wrap items-center justify-center gap-2">
				{#if onRetry}
					<Chip
						variant="secondary"
						size="compact"
						loading={retrying}
						onclick={onRetry}
					>
						Try again
					</Chip>
				{/if}
				{@render action?.()}
			</div>
		{/if}
	</div>
{/if}
