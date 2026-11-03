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
import Redo from '#lib/components/icons/redo.svelte';
import Loading from '#lib/components/loading.svelte';
import ResourceOptionsBar from '#lib/components/resource/resource-options-bar.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import { SandboxTerminal } from '#lib/features/sandboxes/state/sandbox-terminal.svelte.ts';

const terminal = new SandboxTerminal();
const { detail, session } = terminal;
</script>

{#snippet terminalTools()}
	<Chip
		onclick={() => void terminal.openTerminal()}
		leftIcon={SquareArrowUpRight}
	>
		Open in new tab
	</Chip>
{/snippet}

{#if !detail.canWrite}
	<FeedbackState
		class="h-full"
		message="Sandbox write permission is required to access the terminal."
	/>
{:else if !terminal.interactive}
	<FeedbackState
		class="h-full"
		message="Start this sandbox to access its terminal."
	/>
{:else if session.query.isPending}
	<Loading />
{:else if !session.query.data}
	<FeedbackState
		class="h-full"
		tone="error"
		message={session.query.error?.message ??
			'The terminal connection could not be established.'}
	>
		{#snippet action()}
			<Chip leftIcon={Redo} onclick={() => void session.refresh()}
				>Try again</Chip
			>
		{/snippet}
	</FeedbackState>
{:else}
	<div class="flex h-full min-h-0 flex-col">
		<ResourceOptionsBar extras={terminalTools} extrasAlign="end" />
		<iframe
			title={`Terminal for ${detail.sandbox.name}`}
			src={session.query.data.url}
			class="min-h-0 w-full flex-1 border-0 bg-bg"
			referrerpolicy="no-referrer"
		></iframe>
	</div>
{/if}
