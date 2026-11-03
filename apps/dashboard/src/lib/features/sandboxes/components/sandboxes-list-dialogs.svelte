<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import CreateSandboxModal from '#lib/features/sandboxes/components/create/create-sandbox-modal.svelte';
import SandboxActionConfirmModal from '#lib/features/sandboxes/components/sandbox-action-confirm-modal.svelte';
import type { SandboxesList } from '#lib/features/sandboxes/state/sandboxes-list.svelte.ts';

let { list }: { list: SandboxesList } = $props();
</script>

{#if list.limitsQuery.data}
	<CreateSandboxModal
		bind:open={list.createOpen}
		onOpenChange={list.changeCreateOpen}
		pinnedMachineId={list.pinnedMachineId}
		limits={list.limitsQuery.data}
		locations={list.locationsQuery.data}
		snapshots={list.snapshotsQuery.data ?? []}
		usage={list.usageQuery.data}
	/>
{/if}

<SandboxActionConfirmModal
	request={list.request}
	pending={list.confirmPending}
	onClose={() => (list.request = null)}
	onConfirm={list.confirmRequest}
/>
