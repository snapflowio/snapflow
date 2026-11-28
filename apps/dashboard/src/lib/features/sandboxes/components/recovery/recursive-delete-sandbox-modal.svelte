<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import Skeleton, {
	SKELETON_SECTION_ROWS,
} from '#lib/components/ui/skeleton/skeleton.svelte';
import { sandboxCountLabel } from '#lib/features/sandboxes/lib/sandbox-list-actions.ts';
import { sandboxStateLabel } from '#lib/features/sandboxes/lib/sandbox-state.ts';
import type { RecursiveSandboxDelete } from '#lib/features/sandboxes/state/recursive-sandbox-delete.svelte.ts';

interface RecursiveDeleteSandboxModalProps {
	deletion: RecursiveSandboxDelete;
}

let { deletion }: RecursiveDeleteSandboxModalProps = $props();

const count = $derived(deletion.sandboxes.length);

function changeOpen(open: boolean) {
	if (!open) deletion.close();
}
</script>

<ChipModalConfirm
	bind:open={() => deletion.isOpen, changeOpen}
	onsubmit={() => void deletion.deleteTree()}
	title="Delete sandbox and forks"
	text={deletion.loading
		? undefined
		: [
				'Are you sure you want to delete ',
				{ text: sandboxCountLabel(count), bold: true },
				'? ',
				{
					text: 'Descendants are destroyed first, then this sandbox.',
					error: true,
				},
				' Accounting and audit evidence is retained.',
			]}
	pending={deletion.deleting}
	friction="type-name"
	confirmName={deletion.rootName}
>
	{#if deletion.loading}
		<Skeleton class="h-7" repeat={SKELETON_SECTION_ROWS} fade />
	{:else if count > 0}
		<div
			class="flex max-h-48 flex-col overflow-y-auto rounded-xl border border-border"
		>
			{#each deletion.sandboxes as target (target.id)}
				<div
					class="flex h-11 shrink-0 items-center justify-between gap-3 border-border border-b px-4 last:border-b-0"
				>
					<span class="min-w-0 truncate text-(--text-body) text-sm">
						{target.name}
					</span>
					{#if target.state}
						<ResourceStateBadge
							label={sandboxStateLabel(target.state)}
							state={target.state}
						/>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
	{#snippet confirm(ready)}
		<Chip
			type="submit"
			variant="destructive"
			loading={deletion.deleting}
			disabled={!ready || deletion.loading || count === 0}
		>
			{deletion.deleting ? `${deletion.progress} of ${count}` : 'Delete all'}
		</Chip>
	{/snippet}
</ChipModalConfirm>
