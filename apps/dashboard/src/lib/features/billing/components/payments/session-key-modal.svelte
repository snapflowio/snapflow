<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { EscrowWallet } from '#lib/features/billing/lib/escrow-wallet.ts';
import type { SessionKeyGrant } from '#lib/features/billing/state/session-key-draft.svelte.ts';

interface SessionKeyAuthorization {
	wallet: EscrowWallet;
	grant: SessionKeyGrant;
}
</script>

<script lang="ts">
import type { VoucherDelegation } from '@snapflow/api-client';
import {
	simulateSnapflowEscrowSetSessionKey,
	writeSnapflowEscrowSetSessionKey,
} from '@snapflow/contracts/actions';
import { createMutation } from '@tanstack/svelte-query';
import { watch } from 'runed';
import { ESCROW_QUERY_KEYS } from '#lib/api/settlement/escrow.ts';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipInputPrefix from '#lib/components/ui/chip/chip-input-prefix.svelte';
import ChipInputSuffix from '#lib/components/ui/chip/chip-input-suffix.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalError from '#lib/components/ui/chip-modal/chip-modal-error.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import { confirmTransaction } from '#lib/features/billing/lib/escrow-wallet.ts';
import { SessionKeyDraft } from '#lib/features/billing/state/session-key-draft.svelte.ts';
import { formatUsd } from '#lib/utils/usd.ts';

interface SessionKeyModalProps {
	open?: boolean;
	delegation: VoucherDelegation;
	wallet: EscrowWallet;
}

let {
	open = $bindable(false),
	delegation,
	wallet,
}: SessionKeyModalProps = $props();

const fieldId = $props.id();
const ids = {
	spendCap: `${fieldId}-spend-cap`,
	hourlyCap: `${fieldId}-hourly-cap`,
	days: `${fieldId}-days`,
};
const draft = new SessionKeyDraft(() => delegation);
const authorize = createMutation(() => ({
	mutationFn: ({ wallet: signer, grant }: SessionKeyAuthorization) =>
		confirmTransaction(signer, async () => {
			const { request } = await simulateSnapflowEscrowSetSessionKey(
				signer.config,
				{
					address: signer.escrow,
					args: [grant.key, grant.spendCap, grant.hourlyCap, grant.expiry],
					account: signer.account,
					chainId: signer.chainId,
				}
			);
			return writeSnapflowEscrowSetSessionKey(signer.config, request);
		}),
	meta: {
		success:
			'Payments authorized. Snapflow can sign vouchers within these limits.',
		failure: 'The authorization failed',
		invalidates: ESCROW_QUERY_KEYS,
	},
}));

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
	const grant = draft.grant();
	if (!grant || authorize.isPending) return;
	authorize.mutate(
		{ wallet, grant },
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

{#snippet daysSuffix()}
	<ChipInputSuffix>days</ChipInputSuffix>
{/snippet}

<ChipModal
	bind:open
	dismissDisabled={authorize.isPending}
	srTitle="Authorize payments"
	onsubmit={submit}
>
	<ChipModalHeader onClose={close} closeDisabled={authorize.isPending}>
		Authorize payments
	</ChipModalHeader>
	<ChipModalBody>
		<ChipModalField
			label="Spend cap"
			for={ids.spendCap}
			hint={`Most Snapflow can sign for in total. Running sandboxes need about ${formatUsd(delegation.suggestedSpendCapMicroUsd)}.`}
		>
			<ChipInput
				id={ids.spendCap}
				required
				inputmode="decimal"
				bind:value={draft.spendCap}
				startAdornment={dollarPrefix}
			/>
		</ChipModalField>
		<ChipModalField
			label="Hourly cap"
			for={ids.hourlyCap}
			hint={`Most Snapflow can sign for per hour. Running sandboxes need about ${formatUsd(delegation.suggestedHourlyCapMicroUsd)}.`}
		>
			<ChipInput
				id={ids.hourlyCap}
				required
				inputmode="decimal"
				bind:value={draft.hourlyCap}
				startAdornment={dollarPrefix}
			/>
		</ChipModalField>
		<ChipModalField
			label="Valid for"
			for={ids.days}
			hint="The authorization ends after this, even if the caps are not reached."
		>
			<ChipInput
				id={ids.days}
				required
				inputmode="numeric"
				bind:value={draft.days}
				endAdornment={daysSuffix}
			/>
		</ChipModalField>
		<ChipModalError message={draft.error} />
	</ChipModalBody>
	<ChipModalFooter onCancel={close} cancelDisabled={authorize.isPending}>
		{#snippet primaryAction()}
			<ChipModalAction
				type="submit"
				variant="primary"
				disabled={draft.error !== null || authorize.isPending}
			>
				{authorize.isPending ? 'Waiting for the wallet...' : 'Authorize'}
			</ChipModalAction>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
