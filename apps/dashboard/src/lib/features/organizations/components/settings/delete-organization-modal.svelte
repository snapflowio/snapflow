<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const BLOCKED_REASON = 'Resolve the steps above first';
const UNCONFIRMED_REASON = 'Type the organization name to confirm';

function deleteBlockedReason(
	blocked: boolean,
	ready: boolean
): string | undefined {
	if (blocked) return BLOCKED_REASON;
	return ready ? undefined : UNCONFIRMED_REASON;
}
</script>

<script lang="ts">
import { createQuery } from '@tanstack/svelte-query';
import type { AuthOrganization } from '#lib/api/auth/organization.ts';
import { organizationDeletionBlockersQueryOptions } from '#lib/api/deletion-blockers.ts';
import { userErrorMessage } from '#lib/api/errors/api-error-details.ts';
import DeletionBlockers from '#lib/components/settings/deletion-blockers.svelte';
import { deletionSteps } from '#lib/components/settings/deletion-blockers.ts';
import IdentityTile from '#lib/components/ui/avatar/identity-tile.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import { formatDate } from '#lib/utils/format.ts';

interface DeleteOrganizationModalProps {
	open?: boolean;
	organization: AuthOrganization;
	pending: boolean;
	onDelete: () => void;
}

let {
	open = $bindable(false),
	organization,
	pending,
	onDelete,
}: DeleteOrganizationModalProps = $props();

const blockersQuery = createQuery(() => ({
	...organizationDeletionBlockersQueryOptions(),
	enabled: open,
}));
const steps = $derived(
	blockersQuery.data ? deletionSteps(blockersQuery.data) : []
);
const blocked = $derived(!blockersQuery.isSuccess || steps.length > 0);

function submit(): void {
	if (blocked || pending) return;
	onDelete();
}
</script>

<ChipModalConfirm
	bind:open
	onsubmit={submit}
	size="md"
	title="Delete organization"
	text={[
		'Every member loses access. ',
		{ text: "This can't be undone.", error: true },
	]}
	friction="type-name"
	confirmName={organization.name}
	{pending}
>
	<div
		class="flex items-center gap-3 rounded-xl border border-border bg-surface-3 px-4 py-3"
	>
		<IdentityTile name={organization.name} size="md" />
		<div class="flex min-w-0 flex-col">
			<span class="truncate text-(--text-primary) text-sm">
				{organization.name}
			</span>
			<span class="truncate text-(--text-muted) text-xs">
				<span class="font-mono">{organization.slug}</span>
				· created {formatDate(organization.createdAt)}
			</span>
		</div>
	</div>
	<DeletionBlockers
		{steps}
		loading={blockersQuery.isPending}
		errorMessage={blockersQuery.isError
			? userErrorMessage(blockersQuery.error)
			: null}
	/>
	{#snippet confirm(ready)}
		<Chip
			loading={pending}
			type="submit"
			variant="destructive"
			disabledReason={deleteBlockedReason(blocked, ready)}
		>
			Delete organization
		</Chip>
	{/snippet}
</ChipModalConfirm>
