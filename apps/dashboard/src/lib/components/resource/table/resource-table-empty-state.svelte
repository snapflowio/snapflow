<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { Snippet } from 'svelte';
import FeedbackState from '#lib/components/feedback-state.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';

interface ResourceTableEmptyStateProps {
	emptyMessage?: string;
	errorAction?: Snippet;
	errorMessage?: string;
	onRetry?: () => void;
}

let {
	emptyMessage,
	errorAction,
	errorMessage,
	onRetry,
}: ResourceTableEmptyStateProps = $props();
</script>

{#snippet retryAction()}
	<Chip onclick={onRetry}>Try again</Chip>
{/snippet}

<FeedbackState
	class="min-h-40 flex-1"
	tone={errorMessage ? 'error' : 'muted'}
	message={errorMessage || emptyMessage || 'No results'}
	action={errorMessage
		? (errorAction ?? (onRetry ? retryAction : undefined))
		: undefined}
/>
