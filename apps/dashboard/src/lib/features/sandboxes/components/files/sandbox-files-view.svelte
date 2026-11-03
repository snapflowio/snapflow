<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import FeedbackState from '#lib/components/feedback-state.svelte';
import Redo from '#lib/components/icons/redo.svelte';
import Loading from '#lib/components/loading.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import FilesystemWorkspace from '#lib/features/sandboxes/components/files/filesystem-workspace.svelte';
import { isSandboxInteractive } from '#lib/features/sandboxes/lib/sandbox-state.ts';
import { getSandboxDetail } from '#lib/features/sandboxes/state/sandbox-detail.svelte.ts';
import { SandboxToolbox } from '#lib/features/sandboxes/state/sandbox-toolbox.svelte.ts';

const detail = getSandboxDetail();
const interactive = $derived(
	detail.canWrite && isSandboxInteractive(detail.sandbox)
);
const toolbox = new SandboxToolbox(() => ({
	enabled: interactive,
	sandbox: detail.sandbox,
}));
</script>

{#if !detail.canWrite}
	<FeedbackState
		class="h-full"
		message="Sandbox write permission is required to access the filesystem."
	/>
{:else if !interactive}
	<FeedbackState
		class="h-full"
		message="Start this sandbox to browse its filesystem."
	/>
{:else if toolbox.isPending}
	<Loading />
{:else if !toolbox.client}
	<FeedbackState
		class="h-full"
		tone="error"
		message={toolbox.error?.message ??
			'The sandbox filesystem connection could not be established.'}
	>
		{#snippet action()}
			<Chip leftIcon={Redo} onclick={() => void toolbox.refresh()}>
				Try again
			</Chip>
		{/snippet}
	</FeedbackState>
{:else}
	{#key toolbox.client.sandboxId}
		<FilesystemWorkspace client={toolbox.client} />
	{/key}
{/if}
