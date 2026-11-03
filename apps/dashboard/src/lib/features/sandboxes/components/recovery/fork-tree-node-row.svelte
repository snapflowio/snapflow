<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const MAX_FORK_TREE_DEPTH = 3;
</script>

<script lang="ts">
import type { ForkTreeNode } from '#lib/features/sandboxes/state/fork-tree.svelte.ts';
import ForkTreeNodeRow from './fork-tree-node-row.svelte';
import SandboxTreeRow from './sandbox-tree-row.svelte';

interface ForkTreeNodeRowProps {
	depth: number;
	node: ForkTreeNode;
}

let { depth, node }: ForkTreeNodeRowProps = $props();
</script>

<div>
	<SandboxTreeRow
		sandbox={node.sandbox}
		{depth}
		expanded={node.expanded}
		loading={node.loading}
		canExpand={depth < MAX_FORK_TREE_DEPTH}
		onToggle={() => void node.toggle()}
	/>
	{#if node.expanded}
		{#each node.children as child (child.sandbox.id)}
			<ForkTreeNodeRow node={child} depth={depth + 1} />
		{/each}
	{/if}
</div>
