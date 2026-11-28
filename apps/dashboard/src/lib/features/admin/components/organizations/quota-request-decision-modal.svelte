<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { AdminQuotaIncreaseRequest } from '@snapflow/api-client';
import type { QuotaIncreaseDecision } from '#lib/api/admin/quota-increase-requests.ts';

const Outcome = {
	APPROVE: 'approve',
	DENY: 'deny',
} as const;

type Outcome = (typeof Outcome)[keyof typeof Outcome];

const OUTCOME_TABS = [
	{ label: 'Approve', value: Outcome.APPROVE },
	{ label: 'Deny', value: Outcome.DENY },
];
const OUTCOME_DESCRIPTIONS: Record<Outcome, string> = {
	[Outcome.APPROVE]:
		'Raises the custom quota of the organization to at least the requested totals and emails the requester.',
	[Outcome.DENY]: 'Keeps the current limits and emails the reason.',
};
const OUTCOME_VALUES: ReadonlySet<string> = new Set(Object.values(Outcome));

function isOutcome(value: string): value is Outcome {
	return OUTCOME_VALUES.has(value);
}

interface QuotaRequestDecisionModalProps {
	request: AdminQuotaIncreaseRequest | null;
	pending: boolean;
	onDecide: (decision: QuotaIncreaseDecision) => void;
	onClose: () => void;
}
</script>

<script lang="ts">
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import ChipModalTabs from '#lib/components/ui/chip-modal/chip-modal-tabs.svelte';
import {
	requestClassLabel,
	requestedLimitsSummary,
} from '#lib/features/admin/lib/quota-requests-list.ts';

let { request, pending, onDecide, onClose }: QuotaRequestDecisionModalProps =
	$props();

const reasonId = $props.id();
let outcome = $derived.by<Outcome>(() => {
	void request;
	return Outcome.APPROVE;
});
let reason = $derived.by(() => {
	void request;
	return '';
});
const approving = $derived(outcome === Outcome.APPROVE);
const disabled = $derived(pending || (!approving && !reason.trim()));

function submit() {
	if (!request || disabled) return;
	onDecide(
		approving
			? { requestId: request.id, approve: true, note: reason.trim() }
			: { requestId: request.id, approve: false, reason: reason.trim() }
	);
}

function setOpen(open: boolean) {
	if (!open) onClose();
}
</script>

<ChipModal
	bind:open={() => request !== null, setOpen}
	onsubmit={submit}
	srTitle="Review quota request"
	dismissDisabled={pending}
>
	<ChipModalHeader {onClose} closeDisabled={pending}>
		Review quota request
	</ChipModalHeader>
	<ChipModalBody>
		{#if request}
			<KeyValueList framed={false} label="Request">
				<KeyValueRow
					label="Organization"
					value={request.organizationName ?? request.organizationId}
					align="end"
				/>
				<KeyValueRow
					label="Tier"
					value={`Tier ${request.organizationTier}`}
					align="end"
				/>
				<KeyValueRow
					label="Sandbox class"
					value={requestClassLabel(request)}
					align="end"
				/>
				<KeyValueRow
					label="Requested"
					value={requestedLimitsSummary(request)}
					align="end"
				/>
			</KeyValueList>
			<p
				class="wrap-break-word whitespace-pre-line text-(--text-muted) text-sm"
			>
				{request.useCase}
			</p>
		{/if}
		<div class="flex flex-col gap-2">
			<ChipModalTabs
				aria-label="Decision"
				tabs={OUTCOME_TABS}
				value={outcome}
				onChange={(value) => {
					if (isOutcome(value)) outcome = value;
				}}
			/>
			<p
				class={[
					'text-sm',
					approving ? 'text-(--text-muted)' : 'text-(--text-error)',
				]}
			>
				{OUTCOME_DESCRIPTIONS[outcome]}
			</p>
		</div>
		<ChipModalField
			label={approving ? 'Note' : 'Reason'}
			for={reasonId}
			required={!approving}
		>
			<ChipInput
				id={reasonId}
				placeholder={approving
					? 'Optional, recorded with the approval'
					: 'Emailed to the requester'}
				bind:value={reason}
			/>
		</ChipModalField>
	</ChipModalBody>
	<ChipModalFooter onCancel={onClose} cancelDisabled={pending}>
		{#snippet primaryAction()}
			<Chip
				type="submit"
				variant={approving ? 'primary' : 'destructive'}
				loading={pending}
				{disabled}
			>
				{approving ? 'Approve' : 'Deny'}
			</Chip>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
