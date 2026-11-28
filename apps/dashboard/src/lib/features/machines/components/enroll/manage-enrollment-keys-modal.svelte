<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import type { MachineEnrollment } from '#lib/features/machines/state/machine-enrollment.svelte.ts';
import EnrollmentKeyForm from './enrollment-key-form.svelte';
import EnrollmentKeysSection from './enrollment-keys-section.svelte';

interface ManageEnrollmentKeysModalProps {
	enrollment: MachineEnrollment;
}

let { enrollment }: ManageEnrollmentKeysModalProps = $props();

function close(): void {
	enrollment.managing = false;
}

function closeRevoke(open: boolean): void {
	if (!open) enrollment.revoking = null;
}

function confirmRevoke(event: SubmitEvent): void {
	event.preventDefault();
	if (enrollment.revoking) enrollment.confirmRevoke(enrollment.revoking);
}
</script>

<ChipModal
	bind:open={enrollment.managing}
	srTitle="Enrollment keys"
	variant="sheet"
>
	<ChipModalHeader onClose={close}>Enrollment keys</ChipModalHeader>
	<ChipModalBody>
		<div class="flex flex-col gap-8">
			{#if enrollment.canWrite}
				<EnrollmentKeyForm {enrollment} onCreated={close} />
			{/if}
			<EnrollmentKeysSection {enrollment} onWatch={close} />
		</div>
	</ChipModalBody>
	<ChipModalFooter
		onCancel={close}
		cancelLabel="Done"
		defaultAction="dismiss"
	/>
</ChipModal>

<ChipModalConfirm
	bind:open={() => enrollment.revoking !== null, closeRevoke}
	title="Revoke enrollment key"
	text={[
		{ text: enrollment.revoking?.name ?? 'This key', bold: true },
		' ',
		{ text: 'can no longer enroll machines.', error: true },
	]}
	pending={enrollment.revoke.isPending}
	onsubmit={confirmRevoke}
>
	{#snippet confirm()}
		<Chip
			type="submit"
			variant="destructive"
			loading={enrollment.revoke.isPending}
		>
			Revoke
		</Chip>
	{/snippet}
</ChipModalConfirm>
