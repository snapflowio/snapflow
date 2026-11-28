<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { VoucherDelegation } from '@snapflow/api-client';
import { SIGNER_BURST_HOURS } from '@snapflow/contracts';
import { createMutation } from '@tanstack/svelte-query';
import { watch } from 'runed';
import { delegatedSignerMutationOptions } from '#lib/api/settlement/escrow-writes.ts';
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
	formatSeconds,
	signerHostLabel,
} from '#lib/features/billing/lib/escrow-terms.ts';
import { feeConsentNote } from '#lib/features/billing/lib/fee-terms.ts';
import type { FundingSource } from '#lib/features/billing/state/funding-source.svelte.ts';
import { SignerScopeDraft } from '#lib/features/billing/state/signer-scope-draft.svelte.ts';
import { formatHourlyPrice } from '#lib/utils/usd.ts';

interface DelegatedSignerModalProps {
	open?: boolean;
	delegation: VoucherDelegation;
	source: FundingSource;
	replacing?: boolean;
}

let {
	open = $bindable(false),
	delegation,
	source,
	replacing = false,
}: DelegatedSignerModalProps = $props();

const title = $derived(
	replacing ? 'Turn automatic payments on again' : 'Turn on automatic payments'
);

const fieldId = $props.id();
const ids = {
	hourlyCap: `${fieldId}-hourly-cap`,
	days: `${fieldId}-days`,
};
const suggested = $derived(delegation.suggestedSignerScope);
const draft = new SignerScopeDraft(
	() => suggested,
	() => delegation.chainNowSeconds
);
const authorize = createMutation(() => delegatedSignerMutationOptions());

watch(
	() => open,
	(isOpen) => {
		if (isOpen) draft.reset();
	}
);

function close(): void {
	if (authorize.isPending) return;
	open = false;
}

function submit(event: SubmitEvent): void {
	event.preventDefault();
	const scope = draft.scope();
	if (!scope || authorize.isPending) return;
	authorize.mutate(
		{ funder: source.funder, scope },
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

{#snippet hourSuffix()}
	<ChipInputSuffix>/h</ChipInputSuffix>
{/snippet}

{#snippet daysSuffix()}
	<ChipInputSuffix>days</ChipInputSuffix>
{/snippet}

<ChipModal
	bind:open
	dismissDisabled={authorize.isPending}
	srTitle={title}
	onsubmit={submit}
>
	<ChipModalHeader onClose={close} closeDisabled={authorize.isPending}>
		{title}
	</ChipModalHeader>
	<ChipModalBody>
		<ChipModalField
			label="Hourly spending limit"
			for={ids.hourlyCap}
			hint={`Most Snapflow can pay your hosts per hour. Running sandboxes cost ${formatHourlyPrice(delegation.hourlySpendMicroUsd)} now; Snapflow suggests ${formatHourlyPrice(suggested.hourlyCap)}.`}
		>
			<ChipInput
				id={ids.hourlyCap}
				required
				inputmode="decimal"
				bind:value={draft.hourlyCap}
				startAdornment={dollarPrefix}
				endAdornment={hourSuffix}
			/>
		</ChipModalField>
		<ChipModalField
			label="Valid for"
			for={ids.days}
			hint="Automatic payments stop after this; turn them on again before then."
		>
			<ChipInput
				id={ids.days}
				required
				inputmode="numeric"
				bind:value={draft.days}
				endAdornment={daysSuffix}
			/>
		</ChipModalField>
		<p class="text-(--text-muted) text-xs">
			{`The limit starts empty, refills at this rate and holds at most ${SIGNER_BURST_HOURS} hours of it. Lowering it later takes effect after ${formatSeconds(delegation.windows.signerThawSeconds)}. ${feeConsentNote(draft.maxFeeBps)} Hosts: ${signerHostLabel(draft.host)}.`}
		</p>
		<ChipModalError message={draft.error} />
	</ChipModalBody>
	<ChipModalFooter onCancel={close} cancelDisabled={authorize.isPending}>
		{#snippet primaryAction()}
			<Chip
				type="submit"
				variant="primary"
				loading={authorize.isPending}
				disabled={draft.error !== null}
			>
				Turn on
			</Chip>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
