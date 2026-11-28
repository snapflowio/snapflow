<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { RefundDue } from '@snapflow/api-client';

const EMPTY_REFUND = { transactionHash: '' };

interface RecordRefundModalProps {
	refund: RefundDue | null;
	pending: boolean;
	onRecord: (refund: RefundDue, transactionHash: string) => Promise<unknown>;
	onClose: () => void;
}
</script>

<script lang="ts">
import { revalidateLogic } from '@tanstack/svelte-form';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import {
	formSubmitHandler,
	submitMutation,
} from '#lib/components/form/submit.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import { recordRefundSchema } from '#lib/features/admin/lib/refunds-list.ts';
import { formatUsd } from '#lib/utils/usd.ts';

let { refund, pending, onRecord, onClose }: RecordRefundModalProps = $props();

const form = createAppForm(() => ({
	defaultValues: EMPTY_REFUND,
	validationLogic: revalidateLogic(),
	validators: { onDynamic: recordRefundSchema },
	onSubmit: async ({ value }) => {
		if (!refund) return;
		const recorded = refund;
		const submitted = await submitMutation(() =>
			onRecord(recorded, value.transactionHash.trim())
		);
		if (submitted) form.reset();
	},
}));

function setOpen(open: boolean) {
	if (open) return;
	form.reset();
	onClose();
}
</script>

<form.Subscribe
	selector={(state) => [state.canSubmit, state.isSubmitting] as const}
>
	{#snippet children([canSubmit, isSubmitting])}
		{const busy = $derived(pending || isSubmitting)}
		<ChipModalConfirm
			bind:open={() => refund !== null, setOpen}
			title="Record refund"
			text={[
				'Send ',
				{ text: formatUsd(refund?.dueMicroUsd ?? '0'), bold: true },
				' USDC from the fee wallet to ',
				{ text: refund?.customerAddress ?? 'the customer', bold: true },
				' (',
				refund?.customerOrganizationName ?? '',
				'), then enter the transaction hash. ',
				{
					text: 'Recording it settles the refund in the ledger and cannot be undone.',
					error: true,
				},
			]}
			pending={busy}
			onsubmit={formSubmitHandler(form)}
		>
			{#snippet confirm()}
				<Chip
					loading={busy}
					type="submit"
					variant="primary"
					disabled={!canSubmit || busy}
				>
					Record
				</Chip>
			{/snippet}
			<form.AppField name="transactionHash">
				{#snippet children(field)}
					<field.TextField
						label="Transaction hash"
						placeholder="0x..."
						monospace
					/>
				{/snippet}
			</form.AppField>
		</ChipModalConfirm>
	{/snippet}
</form.Subscribe>
