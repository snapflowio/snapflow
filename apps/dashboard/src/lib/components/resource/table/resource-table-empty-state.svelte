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
import EmptyState from '#lib/components/empty-state.svelte';
import FeedbackState from '#lib/components/feedback-state.svelte';
import type { IconComponent } from '#lib/components/icons/icon-component.ts';

interface ResourceTableEmptyStateProps {
	emptyMessage?: string;
	emptyIcon?: IconComponent;
	errorAction?: Snippet;
	errorMessage?: string;
	onRetry?: () => void;
}

let {
	emptyMessage,
	emptyIcon,
	errorAction,
	errorMessage,
	onRetry,
}: ResourceTableEmptyStateProps = $props();
</script>

{#if errorMessage}
	<FeedbackState
		bordered={false}
		tone="error"
		message={errorMessage}
		onRetry={errorAction ? undefined : onRetry}
		action={errorAction}
	/>
{:else}
	<EmptyState
		icon={emptyIcon}
		bordered={false}
		title={emptyMessage || 'No results'}
	/>
{/if}
