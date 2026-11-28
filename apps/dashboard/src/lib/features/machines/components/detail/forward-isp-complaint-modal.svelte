<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Download from '@lucide/svelte/icons/download';
import { revalidateLogic } from '@tanstack/svelte-form';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import {
	formSubmitHandler,
	submitMutation,
} from '#lib/components/form/submit.ts';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import {
	ISP_COMPLAINT_DEFAULTS,
	ISP_COMPLAINT_TEXT_ROWS,
	ISP_PROTOCOL_OPTIONS,
	ispComplaintSchema,
	ispOutcomeCopy,
	toCreateIspComplaint,
} from '#lib/features/machines/lib/isp-complaint.ts';
import type { MachineIspComplaints } from '#lib/features/machines/state/machine-isp-complaints.svelte.ts';

interface ForwardIspComplaintModalProps {
	complaints: MachineIspComplaints;
}

let { complaints }: ForwardIspComplaintModalProps = $props();

const form = createAppForm(() => ({
	defaultValues: ISP_COMPLAINT_DEFAULTS,
	validationLogic: revalidateLogic(),
	validators: { onDynamic: ispComplaintSchema },
	onSubmit: async ({ value }) => {
		await submitMutation(() =>
			complaints.submit(toCreateIspComplaint(ispComplaintSchema.parse(value)))
		);
	},
}));

function close() {
	complaints.close();
	form.reset();
}
</script>

<ChipModal
	open={complaints.forwarding}
	onOpenChange={(nextOpen) => {
		if (!nextOpen) close();
	}}
	onsubmit={formSubmitHandler(form)}
	dismissDisabled={complaints.forward.isPending}
	srTitle="Forward ISP complaint"
	variant="sheet"
>
	<form.AppForm>
		<ChipModalHeader onClose={close}> Forward ISP complaint </ChipModalHeader>
		<ChipModalBody>
			{#if complaints.result}
				{const outcome = $derived(ispOutcomeCopy(complaints.result))}
				<div class="flex flex-col items-start gap-2">
					<Badge size="sm" variant={outcome.variant}>{outcome.label}</Badge>
					<p class="text-(--text-primary) text-sm">{outcome.description}</p>
				</div>
			{:else}
				<p class="text-(--text-muted) text-sm">
					The statement you get names no customer.
				</p>
				<form.AppField name="sourceAddress">
					{#snippet children(field)}
						<field.TextField
							label="Your public IP address"
							inputmode="decimal"
							monospace
						/>
					{/snippet}
				</form.AppField>
				<form.AppField name="destinationAddress">
					{#snippet children(field)}
						<field.TextField
							label="Destination address"
							inputmode="decimal"
							monospace
						/>
					{/snippet}
				</form.AppField>
				<div class="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
					<form.AppField name="destinationPort">
						{#snippet children(field)}
							<field.TextField
								label="Destination port"
								inputmode="numeric"
								placeholder="Optional"
								monospace
							/>
						{/snippet}
					</form.AppField>
					<form.AppField name="protocol">
						{#snippet children(field)}
							<field.SelectField
								label="Protocol"
								options={ISP_PROTOCOL_OPTIONS}
							/>
						{/snippet}
					</form.AppField>
				</div>
				<div class="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
					<form.AppField name="observedFrom">
						{#snippet children(field)}
							<field.TextField label="Traffic started" type="datetime-local" />
						{/snippet}
					</form.AppField>
					<form.AppField name="observedUntil">
						{#snippet children(field)}
							<field.TextField label="Traffic ended" type="datetime-local" />
						{/snippet}
					</form.AppField>
				</div>
				<form.AppField name="complaintText">
					{#snippet children(field)}
						<field.TextareaField
							label="Complaint text"
							rows={ISP_COMPLAINT_TEXT_ROWS}
						/>
					{/snippet}
				</form.AppField>
			{/if}
		</ChipModalBody>
		{#if complaints.result}
			<ChipModalFooter onCancel={close} cancelLabel="Done">
				{#snippet primaryAction(initialFocus)}
					<Chip
						loading={complaints.statement.isPending}
						variant="primary"
						leftIcon={Download}
						disabled={complaints.statement.isPending}
						onclick={complaints.downloadResult}
						{@attach initialFocus}
					>
						Download statement
					</Chip>
				{/snippet}
			</ChipModalFooter>
		{:else}
			<ChipModalFooter onCancel={close}>
				{#snippet primaryAction()}
					<form.SubmitButton> Forward </form.SubmitButton>
				{/snippet}
			</ChipModalFooter>
		{/if}
	</form.AppForm>
</ChipModal>
