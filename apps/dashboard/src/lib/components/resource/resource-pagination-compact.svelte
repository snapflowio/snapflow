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
import type { ResourcePaginationConfig } from './resource-pagination.ts';

interface ResourcePaginationCompactProps {
	pagination: ResourcePaginationConfig;
}

let { pagination }: ResourcePaginationCompactProps = $props();

const offset = $derived(pagination.mode === 'cursor' ? null : pagination);
const currentPage = $derived(
	offset
		? Math.min(Math.max(offset.page, 1), Math.max(offset.totalPages, 1))
		: Math.max(pagination.page, 1)
);
const hasPrevious = $derived(
	pagination.mode === 'cursor' ? pagination.hasPrevious : currentPage > 1
);
const hasNext = $derived(
	pagination.mode === 'cursor'
		? pagination.hasNext
		: currentPage < pagination.totalPages
);
const range = $derived.by(() => {
	if (!offset) return `Page ${formatCount(currentPage)}`;
	if (offset.totalItems === 0) return formatCount(0);
	const first = (currentPage - 1) * offset.pageSize + 1;
	const last = Math.min(currentPage * offset.pageSize, offset.totalItems);
	return `${formatCount(first)}–${formatCount(last)} of ${formatCount(offset.totalItems)}`;
});
const visible = $derived(hasPrevious || hasNext);

function previous(): void {
	if (pagination.mode === 'cursor') pagination.onPrevious();
	else pagination.onPageChange(currentPage - 1);
}

function next(): void {
	if (pagination.mode === 'cursor') pagination.onNext();
	else pagination.onPageChange(currentPage + 1);
}
</script>

{#if visible}
	<nav aria-label="Pagination" class="flex shrink-0 items-center gap-2">
		<IconButton
			variant="ghost"
			label="Previous page"
			icon={ChevronLeft}
			disabled={pagination.disabled || !hasPrevious}
			onclick={previous}
		/>
		<span
			class="whitespace-nowrap px-1 text-(--text-subtle) text-sm tabular-nums"
		>
			{range}
		</span>
		<IconButton
			variant="ghost"
			label="Next page"
			icon={ChevronRight}
			disabled={pagination.disabled || !hasNext}
			onclick={next}
		/>
	</nav>
{/if}
