<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { CreateApiKeyDto } from '@snapflow/api-client';
import * as z from 'zod';
import {
	API_KEY_NAME_MAX_LENGTH,
	type ApiKeyScopeOption,
} from '#lib/features/organizations/lib/api-key-permissions.ts';
import { permissionKeysToRecord } from '#lib/features/organizations/lib/organization-resources.ts';

const SECONDS_PER_DAY = 86_400;
const NEVER_EXPIRES = 'never';
const EXPIRATION_OPTIONS = [
	{ value: '30', label: '30 days' },
	{ value: '90', label: '90 days' },
	{ value: '365', label: '1 year' },
	{ value: NEVER_EXPIRES, label: 'Never' },
] as const;
const DEFAULT_EXPIRATION = EXPIRATION_OPTIONS[1].value;

const createApiKeySchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, 'Name is required')
		.max(
			API_KEY_NAME_MAX_LENGTH,
			`Name must be ${API_KEY_NAME_MAX_LENGTH} characters or fewer`
		),
	expiration: z.string(),
	scopes: z.array(z.string()).min(1, 'Select at least one permission'),
});

type CreateApiKeyValues = z.infer<typeof createApiKeySchema>;

const DEFAULT_VALUES: CreateApiKeyValues = {
	name: '',
	expiration: DEFAULT_EXPIRATION,
	scopes: [],
};

function toCreateApiKeyBody(values: CreateApiKeyValues): CreateApiKeyDto {
	return {
		name: values.name.trim(),
		expiresIn:
			values.expiration === NEVER_EXPIRES
				? undefined
				: Number(values.expiration) * SECONDS_PER_DAY,
		permissions: permissionKeysToRecord(values.scopes),
	};
}

interface CreateApiKeyModalProps {
	scopeOptions: readonly ApiKeyScopeOption[];
	onCreate: (body: CreateApiKeyDto) => Promise<boolean>;
	open?: boolean;
}
</script>

<script lang="ts">
import { revalidateLogic } from '@tanstack/svelte-form';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import { formSubmitHandler } from '#lib/components/form/submit.ts';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';

let {
	onCreate,
	open = $bindable(false),
	scopeOptions,
}: CreateApiKeyModalProps = $props();

const form = createAppForm(() => ({
	defaultValues: DEFAULT_VALUES,
	validationLogic: revalidateLogic(),
	validators: { onDynamic: createApiKeySchema },
	onSubmit: async ({ value }) => {
		if (await onCreate(toCreateApiKeyBody(value))) form.reset();
	},
}));

function close(): void {
	open = false;
	form.reset();
}
</script>

{#snippet nameLabel()}
	Name<span aria-hidden="true" class="ml-0.5 text-(--text-error)">*</span>
{/snippet}

<form.Subscribe selector={(state) => state.isSubmitting}>
	{#snippet children(
		isSubmitting
	)}
		<ChipModal
			bind:open
			onOpenChange={(nextOpen) => {
				if (!nextOpen) form.reset();
			}}
			onsubmit={formSubmitHandler(form)}
			dismissDisabled={isSubmitting}
			srTitle="Create new API key"
		>
			<ChipModalHeader onClose={close} closeDisabled={isSubmitting}>
				Create new API key
			</ChipModalHeader>
			<ChipModalBody>
				<form.AppField name="name">
					{#snippet children(
						field
					)}
						<field.TextField
							label={nameLabel}
							placeholder="e.g., Development, Production"
							maxlength={API_KEY_NAME_MAX_LENGTH}
							autocomplete="off"
							required
						/>
					{/snippet}
				</form.AppField>
				<form.AppField name="expiration">
					{#snippet children(
						field
					)}
						<field.SelectField
							label="Expires after"
							options={EXPIRATION_OPTIONS}
						/>
					{/snippet}
				</form.AppField>
				<div class="flex flex-col gap-2.25">
					<form.AppField name="scopes">
						{#snippet children(
							field
						)}
							<field.MultiSelectField
								label="Permissions"
								placeholder="Select permissions"
								options={scopeOptions}
								searchable
							/>
						{/snippet}
					</form.AppField>
					<p class="px-2 text-(--text-muted) text-caption">
						The key acts for this organization with at most your own
						permissions.
					</p>
				</div>
			</ChipModalBody>
			<ChipModalFooter onCancel={close} cancelDisabled={isSubmitting}>
				{#snippet primaryAction()}
					<ChipModalAction
						type="submit"
						variant="primary"
						disabled={isSubmitting}
					>
						{isSubmitting ? 'Creating...' : 'Create'}
					</ChipModalAction>
				{/snippet}
			</ChipModalFooter>
		</ChipModal>
	{/snippet}
</form.Subscribe>
