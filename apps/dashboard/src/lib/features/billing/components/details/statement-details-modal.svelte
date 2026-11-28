<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import { formatStatementMonth } from '#lib/features/billing/lib/format.ts';
import StatementDetails from './statement-details.svelte';

interface StatementDetailsModalProps {
	month: string | null;
	onClose: () => void;
}

let { month, onClose }: StatementDetailsModalProps = $props();

const title = $derived(month ? formatStatementMonth(month) : 'Statement');
</script>

<ChipModal
	open={month !== null}
	onOpenChange={(open) => {
		if (!open) onClose();
	}}
	srTitle={title}
	size="lg"
>
	<ChipModalHeader {onClose}>{title}</ChipModalHeader>
	<ChipModalBody>
		{#if month}
			{#key month}
				<StatementDetails {month} />
			{/key}
		{/if}
	</ChipModalBody>
</ChipModal>
