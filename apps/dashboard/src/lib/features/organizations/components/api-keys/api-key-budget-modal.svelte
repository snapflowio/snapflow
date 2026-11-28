<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { createQuery } from '@tanstack/svelte-query';
import {
	type ApiKeyListItem,
	apiKeyBudgetQueryOptions,
} from '#lib/api/organizations/api-keys.ts';
import QueryFeedbackState from '#lib/components/query-feedback-state.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import ApiKeyBudgetForm from './api-key-budget-form.svelte';

interface ApiKeyBudgetModalProps {
	apiKey: ApiKeyListItem | null;
	canEdit: boolean;
	onClose: () => void;
}

let { apiKey, canEdit, onClose }: ApiKeyBudgetModalProps = $props();

const budget = createQuery(() => ({
	...apiKeyBudgetQueryOptions(apiKey?.id ?? ''),
	enabled: apiKey !== null,
}));
let form = $state<ApiKeyBudgetForm>();
</script>

<ChipModal
	open={apiKey !== null}
	onOpenChange={(open) => {
		if (!open) onClose();
	}}
	onsubmit={() => form?.submit()}
	variant="sheet"
	srTitle="API key budget"
>
	<ChipModalHeader {onClose}>
		{`Budget · ${apiKey?.name ?? apiKey?.id ?? ''}`}
	</ChipModalHeader>
	{#if budget.isSuccess}
		{#key budget.data.apiKeyId}
			<ApiKeyBudgetForm
				bind:this={form}
				budget={budget.data}
				{canEdit}
				{onClose}
			/>
		{/key}
	{:else}
		<ChipModalBody>
			<QueryFeedbackState
				query={budget}
				loadingMessage="Loading the budget"
				errorMessage="Couldn't load the budget"
			/>
		</ChipModalBody>
	{/if}
</ChipModal>
