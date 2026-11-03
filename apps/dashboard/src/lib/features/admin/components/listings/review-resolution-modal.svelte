<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import {
	type ResolveVerificationReview,
	type VerificationReview,
	VerificationReviewOutcome,
} from '@snapflow/api-client';

const OUTCOME_TABS = [
	{ label: 'Clear', value: VerificationReviewOutcome.Cleared },
	{ label: 'Forfeit earnings', value: VerificationReviewOutcome.Forfeited },
	{ label: 'Delist', value: VerificationReviewOutcome.Delisted },
];
const OUTCOME_DESCRIPTIONS: Record<VerificationReviewOutcome, string> = {
	[VerificationReviewOutcome.Cleared]:
		'Lifts the restriction and releases the frozen earnings.',
	[VerificationReviewOutcome.Forfeited]:
		'Returns the frozen earnings to the affected customers as credit.',
	[VerificationReviewOutcome.Delisted]:
		'Removes the machine from the marketplace.',
};
const OUTCOME_VALUES: ReadonlySet<string> = new Set(
	Object.values(VerificationReviewOutcome)
);

function isOutcome(value: string): value is VerificationReviewOutcome {
	return OUTCOME_VALUES.has(value);
}

interface ReviewResolutionModalProps {
	review: VerificationReview | null;
	pending: boolean;
	onResolve: (
		review: VerificationReview,
		resolution: ResolveVerificationReview
	) => void;
	onClose: () => void;
}
</script>

<script lang="ts">
import ShieldCheck from '@lucide/svelte/icons/shield-check';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import ChipModalTabs from '#lib/components/ui/chip-modal/chip-modal-tabs.svelte';
import { VERIFICATION_REVIEW_KIND_LABELS } from '#lib/features/admin/lib/verification-review.ts';

let { review, pending, onResolve, onClose }: ReviewResolutionModalProps =
	$props();

const reasonId = $props.id();
let outcome = $derived.by<VerificationReviewOutcome>(() => {
	void review;
	return VerificationReviewOutcome.Cleared;
});
let reason = $derived.by(() => {
	void review;
	return '';
});
const disabled = $derived(pending || !reason.trim());

function submit() {
	if (review && !disabled) {
		onResolve(review, { outcome, reason: reason.trim() });
	}
}

function setOpen(open: boolean) {
	if (!open) onClose();
}
</script>

<ChipModal
	bind:open={() => review !== null, setOpen}
	onsubmit={submit}
	srTitle="Resolve review"
	dismissDisabled={pending}
>
	<ChipModalHeader icon={ShieldCheck} {onClose} closeDisabled={pending}>
		Resolve review
	</ChipModalHeader>
	<ChipModalBody>
		{#if review}
			<p class="wrap-break-word px-2 text-(--text-primary) text-sm">
				<strong class="font-medium"
					>{VERIFICATION_REVIEW_KIND_LABELS[review.kind]}</strong
				>
				on machine
				<strong class="font-medium">{review.machineId}</strong>.
			</p>
		{/if}
		<div class="flex flex-col gap-2.25 px-2">
			<ChipModalTabs
				aria-label="Outcome"
				tabs={OUTCOME_TABS}
				value={outcome}
				onChange={(value) => {
					if (isOutcome(value)) outcome = value;
				}}
			/>
			<p
				class={[
					'text-caption',
					outcome === VerificationReviewOutcome.Cleared
						? 'text-(--text-muted)'
						: 'text-(--text-error)',
				]}
			>
				{OUTCOME_DESCRIPTIONS[outcome]}
			</p>
		</div>
		<ChipModalField label="Reason" for={reasonId} required>
			<ChipInput
				id={reasonId}
				placeholder="Recorded in the audit log"
				bind:value={reason}
			/>
		</ChipModalField>
	</ChipModalBody>
	<ChipModalFooter onCancel={onClose} cancelDisabled={pending}>
		{#snippet primaryAction()}
			<ChipModalAction
				type="submit"
				variant={outcome === VerificationReviewOutcome.Cleared
					? 'primary'
					: 'destructive'}
				{disabled}
			>
				{pending ? 'Resolving...' : 'Resolve'}
			</ChipModalAction>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
