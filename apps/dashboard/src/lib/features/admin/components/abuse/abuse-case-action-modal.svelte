<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { PendingCaseAction } from '#lib/features/admin/state/abuse-report-actions.svelte.ts';

interface AbuseCaseActionModalProps {
	pendingAction: PendingCaseAction | null;
	pending: boolean;
	onApply: (pendingAction: PendingCaseAction, note: string | undefined) => void;
	onClose: () => void;
}
</script>

<script lang="ts">
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipTextarea from '#lib/components/ui/chip/chip-textarea.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import {
	ABUSE_CASE_ACTION_DESCRIPTION,
	ABUSE_CASE_ACTION_LABEL,
	isDestructiveCaseAction,
} from '#lib/features/admin/lib/abuse-reports-list.ts';

let { pendingAction, pending, onApply, onClose }: AbuseCaseActionModalProps =
	$props();

const noteId = $props.id();
let note = $derived.by(() => {
	void pendingAction;
	return '';
});
const title = $derived(
	pendingAction ? ABUSE_CASE_ACTION_LABEL[pendingAction.action] : ''
);

function submit() {
	if (pendingAction && !pending)
		onApply(pendingAction, note.trim() || undefined);
}

function setOpen(next: boolean) {
	if (!next) onClose();
}
</script>

<ChipModal
	bind:open={() => pendingAction !== null, setOpen}
	onsubmit={submit}
	srTitle={title}
	dismissDisabled={pending}
>
	<ChipModalHeader {onClose} closeDisabled={pending}>
		{title}
	</ChipModalHeader>
	<ChipModalBody>
		{#if pendingAction}
			<p class="wrap-break-word text-(--text-primary) text-sm">
				Sandbox
				<strong class="font-medium">{pendingAction.abuseCase.sandboxId}</strong>
				of organization
				<strong class="font-medium"
					>{pendingAction.abuseCase.organizationId}</strong
				>.
			</p>
			<p
				class={[
					'text-sm',
					isDestructiveCaseAction(pendingAction.action)
						? 'text-(--text-error)'
						: 'text-(--text-muted)',
				]}
			>
				{ABUSE_CASE_ACTION_DESCRIPTION[pendingAction.action]}
			</p>
		{/if}
		<ChipModalField label="Note" for={noteId}>
			<ChipTextarea
				id={noteId}
				placeholder="Recorded in the case history and audit log"
				bind:value={note}
			/>
		</ChipModalField>
	</ChipModalBody>
	<ChipModalFooter onCancel={onClose} cancelDisabled={pending}>
		{#snippet primaryAction()}
			<Chip
				loading={pending}
				type="submit"
				variant={pendingAction && isDestructiveCaseAction(pendingAction.action)
					? 'destructive'
					: 'primary'}
				disabled={pending}
			>
				Apply
			</Chip>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
