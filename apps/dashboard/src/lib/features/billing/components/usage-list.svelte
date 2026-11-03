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

interface UsageListProps {
	label: string;
	count: number;
	isLoading: boolean;
	isError: boolean;
	isRetrying: boolean;
	onRetry: () => void;
	loadingMessage: string;
	errorMessage: string;
	emptyMessage: string;
	dimmed?: boolean;
	hasMore?: boolean;
	loadingMore?: boolean;
	onLoadMore?: () => void;
	children: Snippet;
}

let {
	label,
	count,
	isLoading,
	isError,
	isRetrying,
	onRetry,
	loadingMessage,
	errorMessage,
	emptyMessage,
	dimmed = false,
	hasMore = false,
	loadingMore = false,
	onLoadMore,
	children,
}: UsageListProps = $props();
</script>

{#snippet inline(
	content: Snippet
)}
	<div class="py-4 text-center text-(--text-muted) text-sm">
		{@render content()}
	</div>
{/snippet}

{#snippet loadingContent()}
	{loadingMessage}
{/snippet}

{#snippet errorContent()}
	<div class="flex flex-col items-center gap-2">
		<span role="alert">{errorMessage}</span>
		<Chip variant="border" disabled={isRetrying} onclick={onRetry}>
			{isRetrying ? 'Retrying...' : 'Try again'}
		</Chip>
	</div>
{/snippet}

{#snippet emptyContent()}
	{emptyMessage}
{/snippet}

<div
	aria-busy={isLoading || dimmed}
	class={[
		'-mx-2 flex flex-col gap-1',
		dimmed && 'opacity-50 transition-opacity',
	]}
>
	{#if isLoading}
		{@render inline(loadingContent)}
	{:else if isError && count === 0}
		{@render inline(errorContent)}
	{:else if count === 0}
		{@render inline(emptyContent)}
	{:else}
		<ul aria-label={label} class="flex flex-col gap-y-0.5">
			{@render children()}
		</ul>
		{#if hasMore && onLoadMore}
			<Chip
				class="self-center"
				disabled={loadingMore}
				onclick={onLoadMore}
				aria-label={`Load more ${label.toLowerCase()}`}
			>
				{loadingMore ? 'Loading...' : 'Load more'}
			</Chip>
		{/if}
	{/if}
</div>
