<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { formatCount } from '#lib/utils/format.ts';
import type { ResourcePaginationConfig } from './resource-pagination.ts';
import ResourcePaginationControls from './resource-pagination-controls.svelte';

interface ResourcePaginationProps {
	pagination: ResourcePaginationConfig;
}

let { pagination }: ResourcePaginationProps = $props();

const cursor = $derived(pagination.mode === 'cursor' ? pagination : null);
const offset = $derived(pagination.mode === 'cursor' ? null : pagination);
const currentPage = $derived(
	offset ? Math.min(Math.max(offset.page, 1), offset.totalPages) : 1
);
const firstItem = $derived(
	offset ? (currentPage - 1) * offset.pageSize + 1 : 0
);
const lastItem = $derived(
	offset ? Math.min(currentPage * offset.pageSize, offset.totalItems) : 0
);
const rangeSummary = $derived(
	`Showing ${formatCount(firstItem)} through ${formatCount(lastItem)} of ${formatCount(offset?.totalItems ?? 0)} items.`
);
</script>

{#if cursor}
	{#if cursor.hasPrevious || cursor.hasNext}
		<nav
			class="flex items-center justify-center border-border border-t bg-bg px-4 py-2.5"
			aria-label="Resource pagination"
		>
			<ResourcePaginationControls
				currentPage={Math.max(cursor.page, 1)}
				hasPrevious={cursor.hasPrevious}
				hasNext={cursor.hasNext}
				disabled={cursor.disabled}
				onPrevious={cursor.onPrevious}
				onNext={cursor.onNext}
			/>
		</nav>
	{/if}
{:else if offset && offset.totalPages > 1}
	<nav
		class="flex items-center justify-center border-border border-t bg-bg px-4 py-2.5"
		aria-label="Resource pagination"
	>
		<span class="sr-only">{rangeSummary}</span>
		<ResourcePaginationControls
			{currentPage}
			totalPages={offset.totalPages}
			hasPrevious={currentPage > 1}
			hasNext={currentPage < offset.totalPages}
			disabled={offset.disabled}
			onPrevious={() => offset.onPageChange(currentPage - 1)}
			onNext={() => offset.onPageChange(currentPage + 1)}
			onPageChange={offset.onPageChange}
		/>
		<span class="sr-only">
			Page {formatCount(currentPage)} of {formatCount(offset.totalPages)}.
		</span>
	</nav>
{/if}
