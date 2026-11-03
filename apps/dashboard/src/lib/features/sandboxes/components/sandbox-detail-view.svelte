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
import ErrorShell from '#lib/components/app/error-shell.svelte';
import ResourceChromeFallback from '#lib/components/resource/resource-chrome-fallback.svelte';
import ResourceDetailShell from '#lib/components/resource/resource-detail-shell.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalConfirmTarget from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';
import ScrollArea from '#lib/components/ui/scroll-area.svelte';
import SandboxOverviewPanel from '#lib/features/sandboxes/components/overview/sandbox-overview-panel.svelte';
import SandboxMoveModal from '#lib/features/sandboxes/components/sandbox-move-modal.svelte';
import SandboxStartChoiceModal from '#lib/features/sandboxes/components/sandbox-start-choice-modal.svelte';
import { deleteSandboxCopy } from '#lib/features/sandboxes/lib/sandbox-detail-actions.ts';
import {
	SandboxDetail,
	setSandboxDetail,
} from '#lib/features/sandboxes/state/sandbox-detail.svelte.ts';
import { SandboxDetailActions } from '#lib/features/sandboxes/state/sandbox-detail-actions.svelte.ts';

let { sandboxId, children }: { sandboxId: string; children: Snippet } =
	$props();

const detail = setSandboxDetail(new SandboxDetail(() => sandboxId));
const actions = new SandboxDetailActions();
</script>

{#if detail.query.isPending}
	<ResourceChromeFallback breadcrumbs={[actions.sandboxesCrumb]} />
{:else if detail.query.isError || !actions.sandbox}
	<ErrorShell
		title="Sandbox unavailable"
		description="This sandbox could not be loaded."
	>
		<Chip href={actions.sandboxesHref}>Go back</Chip>
		<Chip variant="primary" onclick={() => void detail.query.refetch()}>
			Try again
		</Chip>
	</ErrorShell>
{:else}
	{@const sandbox = actions.sandbox}
	<ResourceDetailShell
		breadcrumbs={[actions.sandboxesCrumb, { label: sandbox.name }]}
		crumbActions={actions.crumbActions}
		tabs={actions.tabs}
		actions={actions.headerActions}
	>
		{#snippet aside()}
			<ScrollArea aria-label="Sandbox overview" class="flex-1">
				<SandboxOverviewPanel />
			</ScrollArea>
		{/snippet}
		{#snippet status()}
			<ResourceStateBadge
				errorReason={sandbox.errorReason}
				state={sandbox.state}
			/>
		{/snippet}
		{@render children()}
	</ResourceDetailShell>
	<SandboxStartChoiceModal
		bind:open={
			() => actions.startFailure !== null,
			actions.changeStartChoiceOpen
		}
		failure={actions.startFailure}
		onChoose={actions.chooseStart}
		pending={actions.startMutation.isPending}
	/>
	<SandboxMoveModal
		bind:open={actions.moveOpen}
		failure={actions.moveFailure}
		onOpenChange={actions.changeMoveOpen}
		onMove={actions.move}
		pending={actions.moveMutation.isPending}
	/>
	<ChipModalConfirmTarget
		target={actions.deleteTarget}
		{...deleteSandboxCopy(actions.deleteTarget)}
		pending={actions.removeMutation.isPending}
		onCancel={() => (actions.deleteOpen = false)}
		onConfirm={actions.deleteSandbox}
	/>
{/if}
