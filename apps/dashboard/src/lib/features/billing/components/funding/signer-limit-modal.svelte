<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { EscrowSignerGrant, EscrowWindows } from '@snapflow/api-client';
import { SIGNER_BURST_HOURS } from '@snapflow/contracts';
import { createMutation } from '@tanstack/svelte-query';
import { watch } from 'runed';
import { getAddress } from 'viem';
import {
	lowerSignerLimitMutationOptions,
	raiseSignerLimitMutationOptions,
} from '#lib/api/settlement/escrow-writes.ts';
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
import {
	dateUnixSeconds,
	formatSeconds,
} from '#lib/features/billing/lib/escrow-terms.ts';
import type { FundingSource } from '#lib/features/billing/state/funding-source.svelte.ts';
import {
	SignerLimitChange,
	SignerLimitDraft,
} from '#lib/features/billing/state/signer-limit-draft.svelte.ts';
import { formatHourlyPrice } from '#lib/utils/usd.ts';

interface SignerLimitModalProps {
	open?: boolean;
	grant: EscrowSignerGrant;
	windows: EscrowWindows;
	hourlySpendMicroUsd: string;
	source: FundingSource;
}

let {
	open = $bindable(false),
	grant,
	windows,
	hourlySpendMicroUsd,
	source,
}: SignerLimitModalProps = $props();

const fieldId = $props.id();
const draft = new SignerLimitDraft(() => grant.hourlyCap);
const raise = createMutation(() => raiseSignerLimitMutationOptions());
const lower = createMutation(() => lowerSignerLimitMutationOptions());
const pending = $derived(raise.isPending || lower.isPending);
const changeNote = $derived.by(() => {
	switch (draft.change) {
		case SignerLimitChange.Raise:
			return grant.pendingHourlyCap
				? 'A higher limit applies as soon as the transaction lands and cancels the scheduled lowering.'
				: 'A higher limit applies as soon as the transaction lands.';
		case SignerLimitChange.Lower:
			return `A lower limit takes effect after ${formatSeconds(windows.signerThawSeconds)}, so payments hosts already hold stay claimable.`;
		default:
			return null;
	}
});
const submitLabel = $derived(
	draft.change === SignerLimitChange.Lower ? 'Schedule lower limit' : 'Raise'
);

watch(
	() => open,
	(isOpen) => {
		if (isOpen) draft.reset();
	}
);

function close(): void {
	if (pending) return;
	open = false;
}

function submit(event: SubmitEvent): void {
	event.preventDefault();
	const hourlyCap = draft.next;
	if (!draft.ready || hourlyCap === null || pending) return;
	const signer = getAddress(grant.signerAddress);
	const done = {
		onSuccess: () => {
			open = false;
		},
	};
	if (draft.change === SignerLimitChange.Raise) {
		raise.mutate(
			{
				funder: source.funder,
				signer,
				raise: { hourlyCap, expiry: dateUnixSeconds(grant.expiresAt) },
			},
			done
		);
	} else {
		lower.mutate({ funder: source.funder, signer, hourlyCap }, done);
	}
}
</script>

{#snippet dollarPrefix()}
	<ChipInputPrefix>$</ChipInputPrefix>
{/snippet}

{#snippet hourSuffix()}
	<ChipInputSuffix>/h</ChipInputSuffix>
{/snippet}

<ChipModal
	bind:open
	dismissDisabled={pending}
	srTitle="Hourly spending limit"
	onsubmit={submit}
>
	<ChipModalHeader onClose={close} closeDisabled={pending}>
		Hourly spending limit
	</ChipModalHeader>
	<ChipModalBody>
		<ChipModalField
			label="New limit"
			for={fieldId}
			hint={`Now ${formatHourlyPrice(grant.hourlyCap)}. Running sandboxes cost ${formatHourlyPrice(hourlySpendMicroUsd)}.`}
		>
			<ChipInput
				id={fieldId}
				required
				inputmode="decimal"
				bind:value={draft.hourlyCap}
				startAdornment={dollarPrefix}
				endAdornment={hourSuffix}
			/>
		</ChipModalField>
		<p class="text-(--text-muted) text-xs">
			{changeNote ??
				`The limit refills at this rate and holds at most ${SIGNER_BURST_HOURS} hours of it.`}
		</p>
		<ChipModalError message={draft.error} />
	</ChipModalBody>
	<ChipModalFooter onCancel={close} cancelDisabled={pending}>
		{#snippet primaryAction()}
			<Chip
				type="submit"
				variant="primary"
				loading={pending}
				disabled={!draft.ready}
			>
				{submitLabel}
			</Chip>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
