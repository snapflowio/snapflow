<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ChipModalError from '#lib/components/ui/chip-modal/chip-modal-error.svelte';
import Notice from '#lib/components/ui/notice.svelte';

interface DeletionBlockersProps {
	steps: readonly string[];
	loading: boolean;
	errorMessage: string | null;
}

let { steps, loading, errorMessage }: DeletionBlockersProps = $props();
</script>

{#if loading}
	<p role="status" class="text-(--text-muted) text-sm">
		Checking what needs to happen first...
	</p>
{:else if errorMessage}
	<ChipModalError message={errorMessage} />
{:else if steps.length > 0}
	<div>
		<Notice tone="warning">
			{#snippet title()}
				Before you can delete
			{/snippet}
			{#snippet info()}
				{#each steps as step (step)}
					<span class="block">{step}</span>
				{/each}
			{/snippet}
		</Notice>
	</div>
{/if}
