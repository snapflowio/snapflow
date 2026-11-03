<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { createMutation } from '@tanstack/svelte-query';
import { watch } from 'runed';
import {
	deleteOrganizationMutationOptions,
	organizationIdentityMutationOptions,
} from '#lib/api/organizations/settings.ts';
import { saveDiscardActions } from '#lib/components/page/header-actions.ts';
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import { OrganizationIdentityDraft } from '#lib/features/organizations/state/organization-identity-draft.svelte.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
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
const draft = new OrganizationIdentityDraft();

let deleteOpen = $state(false);

const organization = $derived(auth.activeOrganization);
const editable = $derived(
	permission.can({ organization: ['update'] }) &&
		organization?.personal !== true
);
const canDelete = $derived(
	permission.can({ organization: ['delete'] }) &&
		organization?.personal !== true
);
const saving = $derived(identityMutation.isPending);

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
	description="Name and identity of the active organization."
	dirty={draft.dirty}
	onDiscard={draft.discard}
	actions={[
		{
			id: 'delete',
			kind: 'delete',
			label: 'Delete',
			visible: canDelete,
			disabled: removeMutation.isPending,
			onSelect: () => (deleteOpen = true),
		},
		...(editable
			? saveDiscardActions({
					dirty: draft.dirty,
					saving,
					onSave: save,
					onDiscard: draft.discard,
				})
			: []),
	]}
>
	{#if organization}
		<OrganizationIdentitySection {draft} {editable} {organization} {saving} />
	{/if}
</SettingsPage>

{#if organization}
	<DeleteOrganizationModal
		bind:open={deleteOpen}
		organizationName={organization.name}
		pending={removeMutation.isPending}
		onDelete={deleteOrganization}
	/>
{/if}
