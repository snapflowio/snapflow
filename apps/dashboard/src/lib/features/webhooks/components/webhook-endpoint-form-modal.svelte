<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { WebhookEndpoint } from '@snapflow/api-client';
import type { WebhookEndpointFormValues } from '#lib/features/webhooks/lib/webhook-endpoint-form.ts';

interface WebhookEndpointFormModalProps {
	open: boolean;
	endpoint: WebhookEndpoint | null;
	onOpenChange: (open: boolean) => void;
	onSubmit: (values: WebhookEndpointFormValues) => Promise<boolean>;
}
</script>

<script lang="ts">
import { revalidateLogic } from '@tanstack/svelte-form';
import { watch } from 'runed';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import FieldError from '#lib/components/form/field-error.svelte';
import { formSubmitHandler } from '#lib/components/form/submit.ts';
import LabeledCheckbox from '#lib/components/ui/checkbox/labeled-checkbox.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import {
	WEBHOOK_DESCRIPTION_MAX_LENGTH,
	WEBHOOK_URL_MAX_LENGTH,
	webhookEndpointFormSchema,
	webhookEndpointFormValues,
} from '#lib/features/webhooks/lib/webhook-endpoint-form.ts';
import {
	WEBHOOK_EVENT_GROUPS,
	WEBHOOK_EVENT_LABEL,
	WEBHOOK_EVENT_TYPES,
} from '#lib/features/webhooks/lib/webhook-events.ts';

let { open, endpoint, onOpenChange, onSubmit }: WebhookEndpointFormModalProps =
	$props();

const editing = $derived(endpoint !== null);
const title = $derived(
	editing ? 'Edit webhook endpoint' : 'Add webhook endpoint'
);

const form = createAppForm(() => ({
	defaultValues: webhookEndpointFormValues(endpoint),
	validationLogic: revalidateLogic(),
	validators: { onDynamic: webhookEndpointFormSchema },
	onSubmit: async ({ value }) => {
		await onSubmit(value);
	},
}));

watch(
	() => [open, endpoint] as const,
	([isOpen, current]) => {
		if (isOpen) form.reset(webhookEndpointFormValues(current));
	}
);

function close(): void {
	onOpenChange(false);
}

function toggled(
	selected: readonly WebhookEndpointFormValues['eventTypes'][number][],
	type: WebhookEndpointFormValues['eventTypes'][number],
	checked: boolean
): WebhookEndpointFormValues['eventTypes'] {
	return WEBHOOK_EVENT_TYPES.filter((candidate) =>
		candidate === type ? checked : selected.includes(candidate)
	);
}
</script>

<form.Subscribe
	selector={(state) => [state.isSubmitting, !state.isDefaultValue] as const}
>
	{#snippet children([isSubmitting, dirty])}
		<ChipModal
			{open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) close();
			}}
			onsubmit={formSubmitHandler(form)}
			dismissDisabled={isSubmitting}
			hasUnsavedInput={dirty}
			srTitle={title}
			variant="sheet"
		>
			<ChipModalHeader onClose={close} closeDisabled={isSubmitting}>
				{title}
			</ChipModalHeader>
			<ChipModalBody>
				<form.AppField name="url">
					{#snippet children(field)}
						<field.TextField
							label="Endpoint URL"
							placeholder="https://example.com/webhooks/snapflow"
							maxlength={WEBHOOK_URL_MAX_LENGTH}
							autocomplete="off"
							required
						/>
					{/snippet}
				</form.AppField>
				<form.AppField name="description">
					{#snippet children(field)}
						<field.TextField
							label="Description"
							placeholder="e.g., Production event consumer"
							maxlength={WEBHOOK_DESCRIPTION_MAX_LENGTH}
							autocomplete="off"
						/>
					{/snippet}
				</form.AppField>
				<form.Field name="eventTypes">
					{#snippet children(field)}
						<ChipModalField label="Events">
							{#snippet labelAccessory()}
								<div class="ml-auto flex gap-2">
									<Chip
										size="compact"
										variant="ghost"
										onclick={() => field.handleChange([...WEBHOOK_EVENT_TYPES])}
									>
										Select all
									</Chip>
									<Chip
										size="compact"
										variant="ghost"
										onclick={() => field.handleChange([])}
									>
										Clear
									</Chip>
								</div>
							{/snippet}
							<div class="flex flex-col gap-2">
								<div
									class="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-3"
								>
									{#each WEBHOOK_EVENT_GROUPS as group (group.label)}
										<fieldset class="m-0 min-w-0 border-0 p-4">
											<legend
												class="float-left mb-3 w-full font-medium text-(--text-muted) text-xs"
											>
												{group.label}
											</legend>
											<div class="clear-left flex flex-col gap-3">
												{#each group.eventTypes as eventType (eventType)}
													<LabeledCheckbox
														checked={field.state.value.includes(eventType)}
														onCheckedChange={(checked) =>
															field.handleChange(
																toggled(field.state.value, eventType, checked)
															)}
													>
														{WEBHOOK_EVENT_LABEL[eventType]}
													</LabeledCheckbox>
												{/each}
											</div>
										</fieldset>
									{/each}
								</div>
								<FieldError errors={field.state.meta.errors} />
							</div>
						</ChipModalField>
					{/snippet}
				</form.Field>
			</ChipModalBody>
			<ChipModalFooter onCancel={close} cancelDisabled={isSubmitting}>
				{#snippet primaryAction()}
					<Chip type="submit" variant="primary" loading={isSubmitting}>
						{editing ? 'Save' : 'Add endpoint'}
					</Chip>
				{/snippet}
			</ChipModalFooter>
		</ChipModal>
	{/snippet}
</form.Subscribe>
