<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Archive from '@lucide/svelte/icons/archive';
import GitFork from '@lucide/svelte/icons/git-fork';
import ImageUp from '@lucide/svelte/icons/image';
import ListTree from '@lucide/svelte/icons/list-tree';
import Trash from '#lib/components/icons/trash.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import PageColumn from '#lib/components/page/page-column.svelte';
import SettingsResourceRow from '#lib/components/settings/settings-resource-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import RecursiveDeleteSandboxModal from '#lib/features/sandboxes/components/recovery/recursive-delete-sandbox-modal.svelte';
import SandboxForkTreeModal from '#lib/features/sandboxes/components/recovery/sandbox-fork-tree-modal.svelte';
import SandboxNamedActionModal from '#lib/features/sandboxes/components/recovery/sandbox-named-action-modal.svelte';
import {
	backupStateLabel,
	canCreateSandboxBackup,
	canCreateSandboxSnapshot,
	canDeleteSandbox,
	canForkSandbox,
} from '#lib/features/sandboxes/lib/sandbox-state.ts';
import { SandboxRecovery } from '#lib/features/sandboxes/state/sandbox-recovery.svelte.ts';
import { formatOptionalDateTime } from '#lib/utils/format.ts';

const recovery = new SandboxRecovery();
</script>

{#snippet row(
	rowLabel: string,
	rowValue: string
)}
	<KeyValueRow>
		{#snippet label()}
			{rowLabel}
		{/snippet}
		{#snippet value()}
			{rowValue}
		{/snippet}
	</KeyValueRow>
{/snippet}

{#snippet snapshotAction()}
	<Chip
		disabled={recovery.writeBlocked ||
			!canCreateSandboxSnapshot(recovery.sandbox)}
		onclick={() => recovery.openNamedAction('snapshot')}
	>
		Create
	</Chip>
{/snippet}

{#snippet forkAction()}
	<Chip
		disabled={recovery.writeBlocked || !canForkSandbox(recovery.sandbox)}
		onclick={() => recovery.openNamedAction('fork')}
	>
		Fork
	</Chip>
{/snippet}

{#snippet backupAction()}
	<Chip
		disabled={recovery.writeBlocked ||
			recovery.backupMutation.isPending ||
			!canCreateSandboxBackup(recovery.sandbox)}
		onclick={() => recovery.backupMutation.mutate()}
	>
		{recovery.backupMutation.isPending ? 'Backing up...' : 'Back up'}
	</Chip>
{/snippet}

{#snippet treeAction()}
	<Chip onclick={() => void recovery.forkTree.open()}>View</Chip>
{/snippet}

{#snippet deleteTreeAction()}
	<Chip
		variant="destructive"
		disabled={recovery.pending ||
			!recovery.canDelete ||
			!canDeleteSandbox(recovery.sandbox)}
		onclick={() => void recovery.recursiveDelete.open()}
	>
		Delete all
	</Chip>
{/snippet}

<PageColumn>
	<SettingsSection title="Recovery">
		<div class="flex flex-col gap-y-0.5">
			<SettingsResourceRow
				icon={ImageUp}
				title="Snapshot"
				description="Captures the durable filesystem. /tmp and /run are excluded."
				trailing={snapshotAction}
			/>
			<SettingsResourceRow
				icon={GitFork}
				title="Fork"
				description="Creates an isolated sandbox from the current state."
				trailing={forkAction}
			/>
			<SettingsResourceRow
				icon={Archive}
				title="Backup"
				description="Persists a durable recovery backup."
				trailing={backupAction}
			/>
			<SettingsResourceRow
				icon={ListTree}
				title="Fork tree"
				description="Ancestors and descendants of this sandbox."
				trailing={treeAction}
			/>
		</div>
	</SettingsSection>
	<SettingsSection title="Backup status">
		<KeyValueList>
			{@render row('State', backupStateLabel(recovery.sandbox.backupState))}
			{@render row(
				'Created',
				formatOptionalDateTime(recovery.sandbox.backupCreatedAt, 'Never')
			)}
			{#if recovery.sandbox.backupErrorReason}
				{@render row('Last error', recovery.sandbox.backupErrorReason)}
			{/if}
		</KeyValueList>
	</SettingsSection>
	<SettingsSection title="Danger zone" tone="danger">
		<SettingsResourceRow
			icon={Trash}
			title="Delete sandbox and forks"
			description="Deletes every descendant, then this sandbox."
			trailing={deleteTreeAction}
		/>
	</SettingsSection>
	<SandboxNamedActionModal {recovery} />
</PageColumn>
<SandboxForkTreeModal sandbox={recovery.sandbox} tree={recovery.forkTree} />
<RecursiveDeleteSandboxModal deletion={recovery.recursiveDelete} />
