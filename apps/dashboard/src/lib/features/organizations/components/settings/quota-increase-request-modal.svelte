<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { SandboxClass } from '@snapflow/api-client';
import * as z from 'zod';
import { sandboxClassLabel } from '#lib/features/sandboxes/lib/sandbox-state.ts';

const USE_CASE_MINIMUM_LENGTH = 20;
const USE_CASE_MAXIMUM_LENGTH = 2000;
const USE_CASE_ROWS = 5;
const WHOLE_NUMBER_PATTERN = /^\d+$/;
const NOT_A_WHOLE_NUMBER = 'Enter a whole number';

const quantity = z
	.string()
	.trim()
	.regex(WHOLE_NUMBER_PATTERN, NOT_A_WHOLE_NUMBER);

const requestSchema = z.object({
	sandboxClass: z.enum(SandboxClass),
	requestedCpu: quantity,
	requestedMemory: quantity,
	requestedDisk: quantity,
	requestedGpu: quantity,
	useCase: z
		.string()
		.trim()
		.min(
			USE_CASE_MINIMUM_LENGTH,
			`Describe your use case in at least ${USE_CASE_MINIMUM_LENGTH} characters`
		)
		.max(USE_CASE_MAXIMUM_LENGTH),
});

type RequestValues = z.infer<typeof requestSchema>;

const QUANTITY_FIELDS = [
	{ name: 'requestedCpu', label: 'vCPUs in total', placeholder: '200' },
	{
		name: 'requestedMemory',
		label: 'Memory in total (GiB)',
		placeholder: '400',
	},
	{ name: 'requestedDisk', label: 'Disk in total (GiB)', placeholder: '1000' },
	{ name: 'requestedGpu', label: 'GPUs in total', placeholder: '2' },
] as const satisfies readonly {
	name: keyof RequestValues;
	label: string;
	placeholder: string;
}[];

const CLASS_OPTIONS = Object.values(SandboxClass).map((sandboxClass) => ({
	label: sandboxClassLabel(sandboxClass),
	value: sandboxClass,
}));

const EMPTY_REQUEST: RequestValues = {
	sandboxClass: SandboxClass.LinuxVm,
	requestedCpu: '',
	requestedMemory: '',
	requestedDisk: '',
	requestedGpu: '0',
	useCase: '',
};

interface QuotaIncreaseRequestModalProps {
	open?: boolean;
}
</script>

<script lang="ts">
import { revalidateLogic } from '@tanstack/svelte-form';
import { createMutation } from '@tanstack/svelte-query';
import { createQuotaIncreaseRequestMutationOptions } from '#lib/api/organizations/limits.ts';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import {
	formSubmitHandler,
	submitMutation,
} from '#lib/components/form/submit.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';

let { open = $bindable(false) }: QuotaIncreaseRequestModalProps = $props();

const create = createMutation(() => ({
	...createQuotaIncreaseRequestMutationOptions(),
	onSuccess: close,
}));
const form = createAppForm(() => ({
	defaultValues: EMPTY_REQUEST,
	validationLogic: revalidateLogic(),
	validators: { onDynamic: requestSchema },
	onSubmit: async ({ value }) => {
		await submitMutation(() =>
			create.mutateAsync({
				sandboxClass: value.sandboxClass,
				requestedCpu: Number(value.requestedCpu),
				requestedMemory: Number(value.requestedMemory),
				requestedDisk: Number(value.requestedDisk),
				requestedGpu: Number(value.requestedGpu),
				useCase: value.useCase.trim(),
			})
		);
	},
}));

function close(): void {
	open = false;
	form.reset();
}
</script>

<ChipModal
	bind:open
	onOpenChange={(nextOpen) => !nextOpen && form.reset()}
	variant="sheet"
	srTitle="Request higher limits"
>
	<ChipModalHeader onClose={close}>Request higher limits</ChipModalHeader>
	<form class="flex min-h-0 flex-1 flex-col" onsubmit={formSubmitHandler(form)}>
		<ChipModalBody>
			<p class="text-(--text-muted) text-sm">
				Snapflow reviews the request and emails you the outcome.
			</p>
			<form.AppField name="sandboxClass">
				{#snippet children(field)}
					<field.SelectField label="Sandbox class" options={CLASS_OPTIONS} />
				{/snippet}
			</form.AppField>
			<div class="grid grid-cols-1 gap-x-3 gap-y-6 sm:grid-cols-2">
				{#each QUANTITY_FIELDS as quantityField (quantityField.name)}
					<form.AppField name={quantityField.name}>
						{#snippet children(field)}
							<field.TextField
								label={quantityField.label}
								placeholder={quantityField.placeholder}
								inputmode="numeric"
								autocomplete="off"
							/>
						{/snippet}
					</form.AppField>
				{/each}
			</div>
			<form.AppField name="useCase">
				{#snippet children(field)}
					<field.TextareaField
						label="Use case"
						placeholder="What you run on Snapflow, and why you need more"
						rows={USE_CASE_ROWS}
						maxlength={USE_CASE_MAXIMUM_LENGTH}
					/>
				{/snippet}
			</form.AppField>
		</ChipModalBody>
		<form.Subscribe
			selector={(state) => [state.canSubmit, state.isSubmitting] as const}
		>
			{#snippet children([canSubmit, isSubmitting])}
				<ChipModalFooter onCancel={close} cancelDisabled={isSubmitting}>
					{#snippet primaryAction(initialFocus)}
						<Chip
							loading={isSubmitting}
							type="submit"
							variant="primary"
							disabled={!canSubmit || isSubmitting}
							{@attach initialFocus}
						>
							Send request
						</Chip>
					{/snippet}
				</ChipModalFooter>
			{/snippet}
		</form.Subscribe>
	</form>
</ChipModal>
