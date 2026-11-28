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
import SectionError from '#lib/components/app/section-error.svelte';
import ResourceChromeFallback from '#lib/components/resource/resource-chrome-fallback.svelte';
import ResourceDetailShell from '#lib/components/resource/resource-detail-shell.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import ChipModalConfirmTarget from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';
import SandboxConfigurationModal from '#lib/features/sandboxes/components/overview/sandbox-configuration-modal.svelte';
import SandboxOverviewPanel from '#lib/features/sandboxes/components/overview/sandbox-overview-panel.svelte';
import RecursiveDeleteSandboxModal from '#lib/features/sandboxes/components/recovery/recursive-delete-sandbox-modal.svelte';
import SandboxForkTreeModal from '#lib/features/sandboxes/components/recovery/sandbox-fork-tree-modal.svelte';
import SandboxNamedActionModal from '#lib/features/sandboxes/components/recovery/sandbox-named-action-modal.svelte';
import SandboxActionConfirmModal from '#lib/features/sandboxes/components/sandbox-action-confirm-modal.svelte';
import SandboxConnectPopover from '#lib/features/sandboxes/components/sandbox-connect-popover.svelte';
import SandboxMoveModal from '#lib/features/sandboxes/components/sandbox-move-modal.svelte';
import SandboxStartFlowDialog from '#lib/features/sandboxes/components/sandbox-start-flow-dialog.svelte';
import { deleteSandboxCopy } from '#lib/features/sandboxes/lib/sandbox-detail-actions.ts';
import { sandboxPaymentHold } from '#lib/features/sandboxes/lib/sandbox-payment-hold.ts';
import { sandboxStateLabel } from '#lib/features/sandboxes/lib/sandbox-state.ts';
import { sandboxStateReason } from '#lib/features/sandboxes/lib/sandbox-stop-reason.ts';
import {
	SandboxDetail,
	setSandboxDetail,
} from '#lib/features/sandboxes/state/sandbox-detail.svelte.ts';
import {
	SandboxDetailActions,
	setSandboxDetailActions,
} from '#lib/features/sandboxes/state/sandbox-detail-actions.svelte.ts';

const OVERVIEW_LABEL = 'Overview';

let { sandboxId, children }: { sandboxId: string; children: Snippet } =
	$props();

const detail = setSandboxDetail(new SandboxDetail(() => sandboxId));
const actions = setSandboxDetailActions(new SandboxDetailActions());
let retrying = $state(false);

async function retry(): Promise<void> {
	retrying = true;
	try {
		await detail.query.refetch();
	} finally {
		retrying = false;
	}
}
</script>

{#snippet overviewCards()}
	<SandboxOverviewPanel {detail} {actions} />
{/snippet}

{#if detail.query.isPending}
	<ResourceChromeFallback breadcrumbs={[actions.sandboxesCrumb]} />
{:else if detail.query.isError || !actions.sandbox}
	<SectionError
		title="Couldn't load this sandbox"
		details={detail.query.error?.message}
		backHref={actions.sandboxesHref}
		backLabel="Back to sandboxes"
		{retrying}
		onRetry={() => void retry()}
	/>
{:else}
	{@const sandbox = actions.sandbox}
	{@const hold = sandboxPaymentHold(sandbox)}
	<ResourceDetailShell
		breadcrumbs={[actions.sandboxesCrumb, { label: sandbox.name }]}
		crumbActions={actions.crumbActions}
		tabs={actions.tabs}
		actions={actions.headerActions}
		canWrite={detail.canWrite}
		aside={actions.overviewInTabs ? undefined : overviewCards}
		asideTitle={OVERVIEW_LABEL}
	>
		{#snippet status()}
			<ResourceStateBadge
				variant="pill"
				errorReason={hold ? hold.cause : sandboxStateReason(sandbox)}
				label={hold ? 'Payment hold' : sandboxStateLabel(sandbox.state)}
				state={hold ? 'requires_action' : sandbox.state}
			/>
		{/snippet}
		{#snippet trailing()}
			<SandboxConnectPopover sandboxId={sandbox.id} />
		{/snippet}
		{@render children()}
	</ResourceDetailShell>
	<SandboxStartFlowDialog flow={actions.startFlow} />
	<SandboxActionConfirmModal
		request={actions.confirmRequest}
		pending={actions.confirmPending}
		onClose={actions.closeConfirm}
		onConfirm={actions.runConfirmed}
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
		friction="acknowledge"
		pending={actions.removeMutation.isPending}
		error={actions.removeMutation.error?.message}
		onCancel={() => {
			actions.deleteOpen = false;
			actions.removeMutation.reset();
		}}
		onConfirm={actions.deleteSandbox}
	/>
	<SandboxConfigurationModal
		bind:mode={actions.configurationMode}
		openCount={actions.configurationOpenCount}
	/>
	<SandboxNamedActionModal recovery={actions.recovery} />
	<SandboxForkTreeModal
		sandbox={actions.recovery.sandbox}
		tree={actions.recovery.forkTree}
	/>
	<RecursiveDeleteSandboxModal deletion={actions.recovery.recursiveDelete} />
{/if}
