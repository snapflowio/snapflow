<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import {
	createMutation,
	createQuery,
	useQueryClient,
} from '@tanstack/svelte-query';
import {
	type OrganizationDefaultsValues,
	organizationDefaultsMutationOptions,
	organizationSettingsQueryOptions,
} from '#lib/api/organizations/settings.ts';
import FeedbackState from '#lib/components/feedback-state.svelte';
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import OrganizationDefaultsForm from '#lib/features/organizations/components/settings/organization-defaults-form.svelte';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';

const permission = getOrganizationPermission();
const queryClient = useQueryClient();
const settingsQuery = createQuery(() => organizationSettingsQueryOptions());
const defaultsMutation = createMutation(() => {
	const options = organizationDefaultsMutationOptions(queryClient);
	return { ...options, meta: { ...options.meta, success: undefined } };
});

const canManage = $derived(permission.can({ organization: ['update'] }));

function saveDefaults(
	values: OrganizationDefaultsValues,
	initial: OrganizationDefaultsValues
): Promise<unknown> {
	return defaultsMutation.mutateAsync({ values, initial });
}
</script>

<SettingsPage
	title="Defaults"
	description="Values new sandboxes and other resources start with."
>
	{#if settingsQuery.data}
		<OrganizationDefaultsForm
			{canManage}
			settings={settingsQuery.data}
			saving={defaultsMutation.isPending}
			onSave={saveDefaults}
		/>
	{:else if settingsQuery.isError}
		<FeedbackState
			class="flex-1"
			tone="error"
			retrying={settingsQuery.isFetching}
			onRetry={() => void settingsQuery.refetch()}
		>
			Failed to load the organization defaults
		</FeedbackState>
	{:else}
		<FeedbackState variant="inline">Loading defaults...</FeedbackState>
	{/if}
</SettingsPage>
