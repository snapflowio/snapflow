<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import SquareArrowUpRight from '@lucide/svelte/icons/square-arrow-up-right';
import FeedbackState from '#lib/components/feedback-state.svelte';
import Play from '#lib/components/icons/play.svelte';
import PaneConnecting from '#lib/components/pane-connecting.svelte';
import ResourceOptionsBar from '#lib/components/resource/resource-options-bar.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import SandboxPaneError from '#lib/features/sandboxes/components/sandbox-pane-error.svelte';
import SandboxStartPrompt from '#lib/features/sandboxes/components/sandbox-start-prompt.svelte';
import { desktopViewerUrl } from '#lib/features/sandboxes/lib/sandbox-desktop.ts';
import { SandboxDesktop } from '#lib/features/sandboxes/state/sandbox-desktop.svelte.ts';

const desktop = new SandboxDesktop();
const { detail, toolbox, computerUse, session } = desktop;
</script>

{#snippet desktopTools()}
	<Chip
		onclick={() => void desktop.openDesktop()}
		leftIcon={SquareArrowUpRight}
	>
		Open in new tab
	</Chip>
{/snippet}

{#if !detail.canWrite}
	<FeedbackState
		class="h-full"
		message="Sandbox write permission is required to access the desktop."
	/>
{:else if !desktop.interactive}
	<SandboxStartPrompt message="Start this sandbox to access its desktop." />
{:else if toolbox.isPending ||
	computerUse.isPending ||
	(computerUse.active && session.query.isPending)}
	<PaneConnecting />
{:else if computerUse.unavailable}
	<FeedbackState
		class="h-full"
		message="Computer-use dependencies are not installed in this sandbox."
	/>
{:else if !toolbox.client || computerUse.error}
	<SandboxPaneError
		message={(toolbox.error ?? computerUse.error)?.message ??
			'The sandbox desktop status could not be loaded.'}
		onRetry={() => void desktop.retry()}
	/>
{:else if !computerUse.active}
	<FeedbackState
		class="h-full"
		message="Start the graphical desktop to use this sandbox interactively."
	>
		{#snippet action()}
			<Chip variant="secondary" leftIcon={Play} onclick={computerUse.start}>
				Start desktop
			</Chip>
		{/snippet}
	</FeedbackState>
{:else if !session.query.data}
	<SandboxPaneError
		message={session.query.error?.message ??
			'The desktop connection could not be established.'}
		onRetry={() => void session.refresh()}
	/>
{:else}
	<div class="flex h-full min-h-0 flex-col">
		<ResourceOptionsBar extras={desktopTools} extrasAlign="end" />
		<iframe
			title={`Desktop for ${detail.sandbox.name}`}
			src={desktopViewerUrl(session.query.data.url)}
			class="min-h-0 w-full flex-1 border-0 bg-bg"
			referrerpolicy="no-referrer"
		></iframe>
	</div>
{/if}
