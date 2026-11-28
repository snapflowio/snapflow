<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const READ_ONLY_REASON = 'Needs the Admin or Owner role';
const PERSONAL_REASON = "Personal organizations can't be renamed";
const PERSONAL_DELETE_REASON = "Personal organizations can't be deleted";
const DELETE_REASON = 'Needs the Owner role';
const EXPORT_REASON = 'Needs the Owner role';
</script>

<script lang="ts">
import { createMutation } from '@tanstack/svelte-query';
import { watch } from 'runed';
import { organizationExportMutationOptions } from '#lib/api/data-export.ts';
import {
	deleteOrganizationMutationOptions,
	organizationIdentityMutationOptions,
} from '#lib/api/organizations/settings.ts';
import { saveDiscardActions } from '#lib/components/page/header-actions.ts';
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import SettingsRow from '#lib/components/settings/settings-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipCopyInput from '#lib/components/ui/chip/chip-copy-input.svelte';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { API_BASE_PATH } from '#lib/config/service-paths.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import { OrganizationIdentityDraft } from '#lib/features/organizations/state/organization-identity-draft.svelte.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';
import DeleteOrganizationModal from './delete-organization-modal.svelte';
import OrganizationIdentitySection from './organization-identity-section.svelte';

const auth = getAuth();
const permission = getOrganizationPermission();
const identityMutation = createMutation(() =>
	organizationIdentityMutationOptions()
);
const removeMutation = createMutation(() =>
	deleteOrganizationMutationOptions()
);
const exportData = createMutation(() => organizationExportMutationOptions());
const draft = new OrganizationIdentityDraft();

let deleteOpen = $state(false);

const organization = $derived(auth.activeOrganization);
const personal = $derived(organization?.personal === true);
const editable = $derived(
	permission.can({ organization: ['update'] }) && !personal
);
const canDelete = $derived(
	permission.can({ organization: ['delete'] }) && !personal
);
const deleteDisabledReason = $derived.by(() => {
	if (personal) return PERSONAL_DELETE_REASON;
	return canDelete ? undefined : DELETE_REASON;
});
const canExport = $derived(permission.can({ organization: ['delete'] }));
const saving = $derived(identityMutation.isPending);
const apiEndpoint = $derived(new URL(API_BASE_PATH, page.url.origin).href);

watch(
	() => [organization?.id, organization?.name, organization?.slug] as const,
	([, name, slug]) => {
		draft.reset({ name: name ?? '', slug: slug ?? '' });
	}
);

function save(): void {
	if (!organization || saving) return;
	const data = draft.validate();
	if (!data) return;
	identityMutation.mutate(
		{ data, organizationId: organization.id },
		{
			onSuccess: () => {
				draft.reset(data);
				void auth.refetchOrganizations();
			},
		}
	);
}

function deleteOrganization(): void {
	removeMutation.mutate(undefined, {
		onSuccess: async () => {
			await Promise.all([auth.refetch(), auth.refetchOrganizations()]);
			deleteOpen = false;
			toast.success('Organization deleted');
			await goto(resolve(Path.DASHBOARD));
		},
	});
}
</script>

<SettingsPage
	title="General"
	dirty={draft.dirty}
	onDiscard={draft.discard}
	actions={editable
		? saveDiscardActions({
				dirty: draft.dirty,
				saving,
				onSave: save,
				onDiscard: draft.discard,
			})
		: []}
>
	{#if organization}
		<OrganizationIdentitySection
			{draft}
			{editable}
			{organization}
			{saving}
			readOnlyReason={personal ? PERSONAL_REASON : READ_ONLY_REASON}
		/>

		<SettingsSection title="Reference">
			<SettingsRow layout="split" label="Organization ID">
				{#snippet control(id)}
					<ChipCopyInput
						{id}
						value={organization.id}
						copyLabel="Copy organization ID"
						class="w-full font-mono"
					/>
				{/snippet}
			</SettingsRow>
			<SettingsRow layout="split" label="API endpoint">
				{#snippet control(id)}
					<ChipCopyInput
						{id}
						value={apiEndpoint}
						copyLabel="Copy API endpoint"
						class="w-full font-mono"
					/>
				{/snippet}
			</SettingsRow>
		</SettingsSection>

		<SettingsSection title="Data">
			<SettingsRow
				label="Download data"
				description="A JSON file with this organization's members, resources and settings."
				disabledReason={canExport ? undefined : EXPORT_REASON}
			>
				<Chip
					variant="secondary"
					size="compact"
					loading={exportData.isPending}
					disabled={!canExport}
					onclick={() => exportData.mutate()}
				>
					Download
				</Chip>
			</SettingsRow>
		</SettingsSection>

		<SettingsSection>
			<SettingsRow
				label="Delete organization"
				description="Permanently deletes this organization and everything in it. Every member loses access."
				disabledReason={deleteDisabledReason}
			>
				<Chip
					variant="destructive-secondary"
					size="compact"
					disabled={!canDelete || removeMutation.isPending}
					onclick={() => (deleteOpen = true)}
				>
					Delete
				</Chip>
			</SettingsRow>
		</SettingsSection>
	{/if}
</SettingsPage>

{#if organization}
	<DeleteOrganizationModal
		bind:open={deleteOpen}
		{organization}
		pending={removeMutation.isPending}
		onDelete={deleteOrganization}
	/>
{/if}
