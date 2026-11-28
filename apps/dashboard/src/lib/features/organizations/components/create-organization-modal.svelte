<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import * as z from 'zod';
import {
	ORGANIZATION_NAME_MAX_LENGTH,
	ORGANIZATION_SLUG_MAX_LENGTH,
	organizationNameSchema,
	organizationSlugSchema,
	slugifyOrganizationName,
} from '#lib/features/organizations/lib/organization-slug.ts';

const createOrganizationSchema = z.object({
	name: organizationNameSchema,
	slug: organizationSlugSchema,
});

type CreateOrganizationValues = z.infer<typeof createOrganizationSchema>;

const EMPTY_ORGANIZATION: CreateOrganizationValues = { name: '', slug: '' };

interface CreateOrganizationModalProps {
	open?: boolean;
}
</script>

<script lang="ts">
import { revalidateLogic } from '@tanstack/svelte-form';
import { createMutation } from '@tanstack/svelte-query';
import { createOrganizationMutationOptions } from '#lib/api/auth/organization.ts';
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

let { open = $bindable(false) }: CreateOrganizationModalProps = $props();

const create = createMutation(() => ({
	...createOrganizationMutationOptions(),
	onSuccess: close,
}));
const form = createAppForm(() => ({
	defaultValues: EMPTY_ORGANIZATION,
	validationLogic: revalidateLogic(),
	validators: { onDynamic: createOrganizationSchema },
	onSubmit: async ({ value }) => {
		await submitMutation(() => create.mutateAsync(value));
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
	srTitle="Create organization"
>
	<ChipModalHeader onClose={close}>Create organization</ChipModalHeader>
	<form class="flex min-h-0 flex-1 flex-col" onsubmit={formSubmitHandler(form)}>
		<ChipModalBody>
			<form.AppField
				name="name"
				listeners={{
					onChange: ({ value }) => {
						if (!form.getFieldMeta('slug')?.isDirty) {
							form.setFieldValue('slug', slugifyOrganizationName(value), {
								dontUpdateMeta: true,
							});
						}
					},
				}}
			>
				{#snippet children(field)}
					<field.TextField
						id="organization-name"
						label="Name"
						placeholder="Acme Robotics"
						maxlength={ORGANIZATION_NAME_MAX_LENGTH}
						autocomplete="off"
					/>
				{/snippet}
			</form.AppField>
			<form.AppField name="slug">
				{#snippet children(field)}
					<field.TextField
						id="organization-slug"
						label="Slug"
						placeholder="acme-robotics"
						maxlength={ORGANIZATION_SLUG_MAX_LENGTH}
						autocomplete="off"
					/>
				{/snippet}
			</form.AppField>
			<p class="text-(--text-muted) text-xs">
				The new organization becomes active after it is created.
			</p>
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
							Create
						</Chip>
					{/snippet}
				</ChipModalFooter>
			{/snippet}
		</form.Subscribe>
	</form>
</ChipModal>
