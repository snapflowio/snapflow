<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const NOT_FOUND_STATUS = 404;
</script>

<script lang="ts">
import { createMutation } from '@tanstack/svelte-query';
import { setActiveOrganizationMutationOptions } from '#lib/api/auth/organization.ts';
import SectionError from '#lib/components/app/section-error.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import { Path, resolvePath } from '#lib/routing/paths.ts';
import { refreshAll } from '$app/navigation';
import { page } from '$app/state';

const auth = getAuth();
let retrying = $state(false);
const notFound = $derived(page.status === NOT_FOUND_STATUS);
const title = $derived(
	notFound ? 'Sandbox not found' : "Couldn't load this sandbox"
);
const otherOrganizations = $derived(
	notFound
		? auth.organizations.filter(
				(organization) => organization.id !== auth.activeOrganizationId
			)
		: []
);
const switchOrganization = createMutation(() => ({
	...setActiveOrganizationMutationOptions(),
	onSuccess: async () => {
		await auth.refetch();
		await refreshAll();
	},
}));

async function retry(): Promise<void> {
	retrying = true;
	try {
		await refreshAll();
	} finally {
		retrying = false;
	}
}
</script>

<svelte:head>
	<title>{title} · Snapflow</title>
</svelte:head>

<SectionError
	{title}
	details={notFound ? undefined : page.error?.message}
	backHref={resolvePath(Path.SANDBOXES)}
	backLabel="Back to sandboxes"
	{retrying}
	onRetry={notFound ? undefined : () => void retry()}
>
	{#snippet actions()}
		{#each otherOrganizations as organization (organization.id)}
			<Chip
				variant="secondary"
				loading={switchOrganization.isPending &&
					switchOrganization.variables === organization.id}
				disabled={switchOrganization.isPending}
				onclick={() => switchOrganization.mutate(organization.id)}
			>
				Switch to {organization.name}
			</Chip>
		{/each}
	{/snippet}
</SectionError>
