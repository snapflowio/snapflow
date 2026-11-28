<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { AutoTopUp } from '@snapflow/api-client';
import { createMutation } from '@tanstack/svelte-query';
import { watch } from 'runed';
import { enableAutoTopUpMutationOptions } from '#lib/api/settlement/escrow-writes.ts';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipInputPrefix from '#lib/components/ui/chip/chip-input-prefix.svelte';
import ChipInputSuffix from '#lib/components/ui/chip/chip-input-suffix.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalError from '#lib/components/ui/chip-modal/chip-modal-error.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import ChipModalReviewSection from '#lib/components/ui/chip-modal/chip-modal-review-section.svelte';
import { formatSeconds } from '#lib/features/billing/lib/escrow-terms.ts';
import {
	AutoTopUpDraft,
	MAXIMUM_TIMES_PER_DAY,
	MINIMUM_TIMES_PER_DAY,
} from '#lib/features/billing/state/auto-top-up-draft.svelte.ts';
import type { FundingSource } from '#lib/features/billing/state/funding-source.svelte.ts';
import { formatUsd } from '#lib/utils/usd.ts';

interface AutoTopUpModalProps {
	open?: boolean;
	current: AutoTopUp;
	minimumDeposit: bigint | null;
	source: FundingSource;
}

let {
	open = $bindable(false),
	current,
	minimumDeposit,
	source,
}: AutoTopUpModalProps = $props();

const fieldId = $props.id();
const ids = {
	amount: `${fieldId}-amount`,
	threshold: `${fieldId}-threshold`,
	timesPerDay: `${fieldId}-times-per-day`,
	allowance: `${fieldId}-allowance`,
};
const draft = new AutoTopUpDraft(
	() => current,
	() => minimumDeposit
);
const enable = createMutation(() => enableAutoTopUpMutationOptions());
const RELAY_INFO =
	"Snapflow's relayer keeps this from each top-up for its gas. It can only pull into your own escrow balance.";

watch(
	() => open,
	(isOpen) => {
		if (isOpen) draft.reset();
	}
);

function close(): void {
	if (enable.isPending) return;
	open = false;
}

function submit(event: SubmitEvent): void {
	event.preventDefault();
	const settings = draft.settings();
	const allowance = draft.allowanceUnits();
	if (!settings || allowance === null || enable.isPending) return;
	enable.mutate(
		{ funder: source.funder, settings, allowance },
		{
			onSuccess: () => {
				open = false;
			},
		}
	);
}
</script>

{#snippet dollarPrefix()}
	<ChipInputPrefix>$</ChipInputPrefix>
{/snippet}

{#snippet timesSuffix()}
	<ChipInputSuffix>times a day</ChipInputSuffix>
{/snippet}

<ChipModal
	bind:open
	dismissDisabled={enable.isPending}
	srTitle="Auto top-up"
	onsubmit={submit}
>
	<ChipModalHeader onClose={close} closeDisabled={enable.isPending}>
		Auto top-up
	</ChipModalHeader>
	<ChipModalBody>
		<ChipModalField
			label="Top up"
			for={ids.amount}
			hint="Pulled from the funding wallet each time; the relay fee comes out of it."
		>
			<ChipInput
				id={ids.amount}
				required
				inputmode="decimal"
				bind:value={draft.amount}
				startAdornment={dollarPrefix}
			/>
		</ChipModalField>
		<ChipModalField
			label="When the balance drops below"
			for={ids.threshold}
			hint="The escrow balance, including any requested withdrawal."
		>
			<ChipInput
				id={ids.threshold}
				required
				inputmode="decimal"
				bind:value={draft.threshold}
				startAdornment={dollarPrefix}
			/>
		</ChipModalField>
		<ChipModalField
			label="At most"
			for={ids.timesPerDay}
			hint={`From ${MINIMUM_TIMES_PER_DAY} to ${MAXIMUM_TIMES_PER_DAY}. The escrow enforces the gap between top-ups on-chain.`}
		>
			<ChipInput
				id={ids.timesPerDay}
				required
				inputmode="numeric"
				bind:value={draft.timesPerDay}
				endAdornment={timesSuffix}
			/>
		</ChipModalField>
		<ChipModalField
			label="USDC allowance"
			for={ids.allowance}
			hint="Total the escrow may pull from the funding wallet; top-ups stop once it is used up."
		>
			<ChipInput
				id={ids.allowance}
				required
				inputmode="decimal"
				bind:value={draft.allowance}
				startAdornment={dollarPrefix}
			/>
		</ChipModalField>
		<ChipModalReviewSection title="Terms">
			<KeyValueRow
				align="end"
				label="Relay fee"
				info={RELAY_INFO}
				value={`up to ${formatUsd(draft.maxRelayFee)} per top-up`}
			/>
			<KeyValueRow
				align="end"
				label="Gap between top-ups"
				value={`at least ${formatSeconds(current.minInterval)}`}
			/>
		</ChipModalReviewSection>
		<ChipModalError message={draft.error} />
	</ChipModalBody>
	<ChipModalFooter onCancel={close} cancelDisabled={enable.isPending}>
		{#snippet primaryAction()}
			<Chip
				type="submit"
				variant="primary"
				loading={enable.isPending}
				disabled={draft.error !== null}
			>
				{current.enabled ? 'Apply' : 'Turn on'}
			</Chip>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
