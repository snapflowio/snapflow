<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { HostMachine } from '@snapflow/api-client';
import { createQuery } from '@tanstack/svelte-query';
import { machineMarketQueryOptions } from '#lib/api/listings.ts';
import FeedbackState from '#lib/components/feedback-state.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import Skeleton, {
	SKELETON_BLOCK_ROWS,
} from '#lib/components/ui/skeleton/skeleton.svelte';
import MachinePriceEditor from './machine-price-editor.svelte';

interface MachinePriceFormProps {
	machine: HostMachine;
	onClose: () => void;
}

let { machine, onClose }: MachinePriceFormProps = $props();

const marketQuery = createQuery(() =>
	machineMarketQueryOptions(machine.machineId)
);
</script>

{#if marketQuery.isSuccess}
	<MachinePriceEditor {machine} market={marketQuery.data} {onClose} />
{:else}
	<ChipModalBody>
		<div>
			{#if marketQuery.isError}
				<FeedbackState
					variant="inline"
					tone="error"
					resource="market rates"
					error={marketQuery.error}
					retrying={marketQuery.isFetching}
					onRetry={() => void marketQuery.refetch()}
				/>
			{:else}
				<Skeleton class="h-9" repeat={SKELETON_BLOCK_ROWS} fade />
			{/if}
		</div>
	</ChipModalBody>
	<ChipModalFooter onCancel={onClose} defaultAction="dismiss" />
{/if}
