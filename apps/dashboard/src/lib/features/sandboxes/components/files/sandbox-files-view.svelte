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
import PaneConnecting from '#lib/components/pane-connecting.svelte';
import FilesystemWorkspace from '#lib/features/sandboxes/components/files/filesystem-workspace.svelte';
import SandboxPaneError from '#lib/features/sandboxes/components/sandbox-pane-error.svelte';
import SandboxStartPrompt from '#lib/features/sandboxes/components/sandbox-start-prompt.svelte';
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
	<SandboxStartPrompt message="Start this sandbox to browse its filesystem." />
{:else if toolbox.isPending}
	<PaneConnecting />
{:else if !toolbox.client}
	<SandboxPaneError
		message={toolbox.error?.message ??
			'The sandbox filesystem connection could not be established.'}
		onRetry={() => void toolbox.refresh()}
	/>
{:else}
	{#key toolbox.client.sandboxId}
		<FilesystemWorkspace client={toolbox.client} />
	{/key}
{/if}
