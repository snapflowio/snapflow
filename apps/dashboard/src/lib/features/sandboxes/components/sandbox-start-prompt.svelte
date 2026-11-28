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
import Play from '#lib/components/icons/play.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Spinner from '#lib/components/ui/spinner.svelte';
import {
	canRunSandboxLifecycleAction,
	isSandboxBecomingReady,
	sandboxStateLabel,
} from '#lib/features/sandboxes/lib/sandbox-state.ts';
import { getSandboxDetail } from '#lib/features/sandboxes/state/sandbox-detail.svelte.ts';
import { getSandboxDetailActions } from '#lib/features/sandboxes/state/sandbox-detail-actions.svelte.ts';

const STARTING_LABEL = 'Starting';

let { message }: { message: string } = $props();

const detail = getSandboxDetail();
const actions = getSandboxDetailActions();
const becomingReady = $derived(isSandboxBecomingReady(detail.sandbox));
const starting = $derived(actions.starting || becomingReady);
const canStart = $derived(
	detail.canWrite && canRunSandboxLifecycleAction(detail.sandbox, 'start')
);
const progressLabel = $derived(
	becomingReady ? sandboxStateLabel(detail.sandbox.state) : STARTING_LABEL
);
</script>

{#if starting}
	<FeedbackState
		class="h-full"
		message={`${progressLabel}... This view opens once the sandbox is running.`}
	>
		{#snippet action()}
			<Spinner size="md" label={progressLabel} />
		{/snippet}
	</FeedbackState>
{:else}
	<FeedbackState class="h-full" {message}>
		{#snippet action()}
			{#if canStart}
				<Chip variant="secondary" leftIcon={Play} onclick={actions.start}>
					Start sandbox
				</Chip>
			{/if}
		{/snippet}
	</FeedbackState>
{/if}
