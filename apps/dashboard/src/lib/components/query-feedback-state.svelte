<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { CreateQueryResult } from '@tanstack/svelte-query';
import type { ClassValue } from 'svelte/elements';
import { cn } from '#lib/utils/utils.ts';
import FeedbackState from './feedback-state.svelte';

interface QueryFeedbackStateProps {
	class?: ClassValue;
	errorMessage: string;
	loadingMessage: string;
	query: Pick<CreateQueryResult, 'isError' | 'isFetching' | 'refetch'>;
}

let {
	class: className,
	errorMessage,
	loadingMessage,
	query,
}: QueryFeedbackStateProps = $props();
</script>

{#if !query.isError}
	<FeedbackState class={cn('flex-1', className)} message={loadingMessage} />
{:else}
	<FeedbackState
		class={cn('flex-1', className)}
		tone="error"
		message={errorMessage}
		retrying={query.isFetching}
		onRetry={() => void query.refetch()}
	/>
{/if}
