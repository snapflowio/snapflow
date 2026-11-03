<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ChevronLeft from '@lucide/svelte/icons/chevron-left';
import ChevronRight from '@lucide/svelte/icons/chevron-right';
import IconButton from '#lib/components/ui/icon-button.svelte';
import { formatCount } from '#lib/utils/format.ts';
import { paginationWindow } from './resource-pagination.ts';

interface ResourcePaginationControlsProps {
	currentPage: number;
	totalPages?: number;
	hasPrevious: boolean;
	hasNext: boolean;
	disabled?: boolean;
	onPrevious: () => void;
	onNext: () => void;
	onPageChange?: (page: number) => void;
}

let {
	currentPage,
	totalPages,
	hasPrevious,
	hasNext,
	disabled,
	onPrevious,
	onNext,
	onPageChange,
}: ResourcePaginationControlsProps = $props();
</script>

<div class="flex items-center gap-1">
	<IconButton
		variant="ghost"
		label="Previous page"
		icon={ChevronLeft}
		disabled={disabled || !hasPrevious}
		onclick={onPrevious}
	/>

	{#if totalPages && onPageChange}
		<div class="mx-3 flex items-center gap-4">
			{#each paginationWindow(currentPage, totalPages) as page (page)}
				<button
					type="button"
					class={[
						'cursor-pointer text-sm tabular-nums outline-none transition-colors hover-hover:text-(--text-body) focus-visible:text-(--text-body) disabled:cursor-not-allowed',
						page === currentPage ? 'text-(--text-body)' : 'text-(--text-muted)',
					]}
					aria-current={page === currentPage ? 'page' : undefined}
					aria-label={`Go to page ${page}`}
					{disabled}
					onclick={() => onPageChange(page)}
				>
					{page}
				</button>
			{/each}
		</div>
	{:else}
		<span class="mx-3 text-(--text-body) text-small tabular-nums">
			{formatCount(currentPage)}
		</span>
	{/if}

	<IconButton
		variant="ghost"
		label="Next page"
		icon={ChevronRight}
		disabled={disabled || !hasNext}
		onclick={onNext}
	/>
</div>
