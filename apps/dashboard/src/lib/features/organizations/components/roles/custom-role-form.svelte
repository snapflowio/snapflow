<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { isStaticOrganizationRole } from '@snapflow/organization-access';
import * as z from 'zod';
import type {
	CustomRoleInput,
	OrganizationCustomRole,
} from '#lib/api/organizations/roles.ts';

const ROLE_NAME_MAX_LENGTH = 64;
const ROLE_DESCRIPTION_MAX_LENGTH = 255;
const ROLE_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const customRoleSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, 'Name is required')
		.max(
			ROLE_NAME_MAX_LENGTH,
			`Name must be ${ROLE_NAME_MAX_LENGTH} characters or fewer`
		)
		.regex(
			ROLE_NAME_PATTERN,
			'Use lowercase letters, numbers and single hyphens between them'
		)
		.refine(
			(name) => !isStaticOrganizationRole(name),
			'This name belongs to a built-in role'
		),
	description: z
		.string()
		.trim()
		.max(
			ROLE_DESCRIPTION_MAX_LENGTH,
			`Description must be ${ROLE_DESCRIPTION_MAX_LENGTH} characters or fewer`
		),
	permissions: z.array(z.string()).min(1, 'Select at least one permission'),
});

export interface CustomRoleFormProps {
	onClose: () => void;
	onSubmit: (input: CustomRoleInput) => Promise<unknown>;
	role: OrganizationCustomRole | null;
	title: string;
}
</script>

<script lang="ts">
import { revalidateLogic } from '@tanstack/svelte-form';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import FieldError from '#lib/components/form/field-error.svelte';
import { firstFieldError } from '#lib/components/form/field-errors.ts';
import {
	formSubmitHandler,
	submitMutation,
} from '#lib/components/form/submit.ts';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import { toOrganizationPermission } from '#lib/features/organizations/lib/organization-permission.ts';
import {
	permissionKeys,
	permissionKeysToRecord,
} from '#lib/features/organizations/lib/organization-resources.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import PermissionMatrix from './permission-matrix.svelte';

let { onClose, onSubmit, role, title }: CustomRoleFormProps = $props();

const fieldId = $props.id();
const permission = getOrganizationPermission();

const form = createAppForm(() => ({
	defaultValues: {
		name: role?.role ?? '',
		description: role?.description ?? '',
		permissions: role ? permissionKeys(role.permission) : [],
	},
	validationLogic: revalidateLogic(),
	validators: { onDynamic: customRoleSchema },
	onSubmit: async ({ value }) => {
		await submitMutation(() =>
			onSubmit({
				name: value.name.trim(),
				description: value.description.trim(),
				permission: permissionKeysToRecord(value.permissions),
			})
		);
	},
}));

function isGrantable(resource: string, action: string): boolean {
	const requested = toOrganizationPermission(resource, action);
	return requested !== null && permission.can(requested);
}
</script>

<ChipModalHeader {onClose}>{title}</ChipModalHeader>
<form novalidate onsubmit={formSubmitHandler(form)}>
	<form.AppForm>
		<ChipModalBody>
			<form.AppField name="name">
				{#snippet children(
					field
				)}
					<field.TextField
						id={`${fieldId}-name`}
						label="Name"
						placeholder="deployer"
						maxlength={ROLE_NAME_MAX_LENGTH}
						autocomplete="off"
					/>
				{/snippet}
			</form.AppField>
			<form.AppField name="description">
				{#snippet children(
					field
				)}
					<field.TextareaField
						id={`${fieldId}-description`}
						label="Description"
						placeholder="Deploys sandboxes from approved snapshots"
					/>
				{/snippet}
			</form.AppField>
			<form.AppField name="permissions">
				{#snippet children(
					field
				)}
					<div class="flex flex-col gap-2.25 px-2">
						<span class="pl-0.5 text-(--text-muted) text-small"
							>Permissions</span
						>
						<PermissionMatrix
							value={field.state.value}
							onChange={field.handleChange}
							{isGrantable}
						/>
						{#if firstFieldError(field.state.meta.errors)}
							<FieldError errors={field.state.meta.errors} />
						{:else}
							<p class="text-(--text-muted) text-caption">
								You can only grant permissions you hold yourself.
							</p>
						{/if}
					</div>
				{/snippet}
			</form.AppField>
		</ChipModalBody>
		<form.Subscribe selector={(state) => state.isSubmitting}>
			{#snippet children(
				isSubmitting
			)}
				<ChipModalFooter onCancel={onClose} cancelDisabled={isSubmitting}>
					{#snippet primaryAction()}
						<form.SubmitButton
							pendingLabel={role ? 'Saving...' : 'Creating...'}
						>
							{role ? 'Save' : 'Create'}
						</form.SubmitButton>
					{/snippet}
				</ChipModalFooter>
			{/snippet}
		</form.Subscribe>
	</form.AppForm>
</form>
