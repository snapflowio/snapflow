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
import { isAdminMfaRequired } from '#lib/api/admin/mfa.ts';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';
import FeedbackState from '#lib/components/feedback-state.svelte';
import QueryFeedbackState from '#lib/components/query-feedback-state.svelte';
import AdminStepUpAction from './admin-step-up-action.svelte';

interface AdminQueryFeedbackProps {
	errorMessage: string;
	loadingMessage: string;
	query: Pick<
		CreateQueryResult,
		'error' | 'isError' | 'isFetching' | 'refetch'
	>;
}

let { errorMessage, loadingMessage, query }: AdminQueryFeedbackProps = $props();
</script>

{#snippet stepUpAction()}
	<AdminStepUpAction />
{/snippet}

{#if isAdminMfaRequired(query.error)}
	<FeedbackState
		class="flex-1"
		tone="error"
		message={SnapflowError.fromUnknown(query.error).message}
		action={stepUpAction}
	/>
{:else}
	<QueryFeedbackState {errorMessage} {loadingMessage} {query} />
{/if}
