<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { Sandbox } from '@snapflow/api-client';
import FeedbackState from '#lib/components/feedback-state.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import type { ForkTree } from '#lib/features/sandboxes/state/fork-tree.svelte.ts';
import ForkTreeNodeRow from './fork-tree-node-row.svelte';
import SandboxTreeRow from './sandbox-tree-row.svelte';

interface SandboxForkTreeModalProps {
	sandbox: Sandbox;
	tree: ForkTree;
}

let { sandbox, tree }: SandboxForkTreeModalProps = $props();

function changeOpen(open: boolean) {
	if (!open) tree.close();
}
</script>

<ChipModal
	bind:open={() => tree.isOpen, changeOpen}
	srTitle="Fork tree"
	size="lg"
>
	<ChipModalHeader>Fork tree</ChipModalHeader>
	<ChipModalBody>
		{#if tree.loading}
			<FeedbackState class="min-h-0 py-4" message="Loading..." />
		{:else}
			<div class="flex flex-col gap-px px-2">
				{#each tree.ancestors as ancestor (ancestor.id)}
					<SandboxTreeRow sandbox={ancestor} depth={0} />
				{/each}
				<SandboxTreeRow {sandbox} depth={0} current />
				{#each tree.children as node (node.sandbox.id)}
					<ForkTreeNodeRow {node} depth={1} />
				{/each}
			</div>
			{#if tree.children.length === 0 && tree.ancestors.length === 0}
				<FeedbackState class="min-h-0 py-4" message="No forks" />
			{/if}
		{/if}
	</ChipModalBody>
	<ChipModalFooter defaultAction="dismiss" cancelLabel="Close" />
</ChipModal>
