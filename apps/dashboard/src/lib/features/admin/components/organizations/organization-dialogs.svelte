<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import type { AdminOrganizationActions } from '#lib/features/admin/state/admin-organization-actions.svelte.ts';
import SuspendOrganizationModal from './suspend-organization-modal.svelte';

interface OrganizationDialogsProps {
	actions: AdminOrganizationActions;
}

let { actions }: OrganizationDialogsProps = $props();

function setUnsuspendOpen(open: boolean) {
	if (!open) actions.close();
}
</script>

<SuspendOrganizationModal
	organization={actions.suspending}
	pending={actions.suspend.isPending}
	onSuspend={actions.confirmSuspend}
	onClose={actions.close}
/>
<ChipModalConfirm
	bind:open={() => actions.unsuspending !== null, setUnsuspendOpen}
	title="Unsuspend organization"
	text={[
		'Unsuspending ',
		{
			text: actions.unsuspending?.name ?? 'this organization',
			bold: true,
		},
		' lets its members change resources again.',
	]}
	pending={actions.unsuspend.isPending}
	onsubmit={actions.confirmUnsuspend}
>
	{#snippet confirm()}
		<ChipModalAction
			type="submit"
			variant="primary"
			disabled={actions.unsuspend.isPending}
		>
			{actions.unsuspend.isPending ? 'Unsuspending...' : 'Unsuspend'}
		</ChipModalAction>
	{/snippet}
</ChipModalConfirm>
