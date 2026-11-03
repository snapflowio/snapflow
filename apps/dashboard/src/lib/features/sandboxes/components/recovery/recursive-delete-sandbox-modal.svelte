<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import FeedbackState from '#lib/components/feedback-state.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import { sandboxCountLabel } from '#lib/features/sandboxes/lib/sandbox-list-actions.ts';
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
>
	{#if deletion.loading}
		<FeedbackState class="min-h-0 py-4" message="Loading..." />
	{:else if count > 0}
		<div
			class="mx-2 flex max-h-48 flex-col overflow-y-auto rounded-md border border-border bg-surface-2"
		>
			{#each deletion.sandboxes as target (target.id)}
				<div
					class="flex h-10 shrink-0 items-center justify-between gap-3 border-border border-b px-3 last:border-b-0"
				>
					<span class="min-w-0 truncate text-(--text-body) text-small">
						{target.name}
					</span>
					{#if target.state}
						<ResourceStateBadge state={target.state} />
					{/if}
				</div>
			{/each}
		</div>
	{/if}
	{#snippet confirm()}
		<ChipModalAction
			type="submit"
			variant="destructive"
			disabled={deletion.loading || deletion.deleting || count === 0}
		>
			{deletion.deleting
				? `Deleting ${deletion.progress}/${count}...`
				: 'Delete all'}
		</ChipModalAction>
	{/snippet}
</ChipModalConfirm>
