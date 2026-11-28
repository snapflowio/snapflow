<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const MANAGE_REQUIRED = 'Needs billing: manage';

type WithdrawalConfirm = 'cancel' | 'complete';
</script>

<script lang="ts">
import type { EscrowAccount } from '@snapflow/api-client';
import { userErrorMessage } from '#lib/api/errors/api-error-details.ts';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import type { PendingEscrowRow } from '#lib/features/billing/lib/pending-escrow.ts';
import { EscrowWithdrawal } from '#lib/features/billing/state/escrow-withdrawal.svelte.ts';
import type { FundingSource } from '#lib/features/billing/state/funding-source.svelte.ts';
import { shortAddress } from '#lib/features/wallet/lib/payment-wallet.ts';
import { formatUsd } from '#lib/utils/usd.ts';
import PendingEscrowTable from './pending-escrow-table.svelte';

interface PendingEscrowListProps {
	account: EscrowAccount;
	rows: readonly PendingEscrowRow[];
	delayed: boolean;
	source: FundingSource;
	canManage: boolean;
}

let { account, rows, delayed, source, canManage }: PendingEscrowListProps =
	$props();

const withdrawal = new EscrowWithdrawal(
	() => account,
	() => source
);
let confirming = $state<WithdrawalConfirm | null>(null);
let failure = $state<string | null>(null);

const actionReason = $derived.by(() => {
	if (!canManage) return MANAGE_REQUIRED;
	return source.signer ? null : source.hint;
});
const pendingAmount = $derived(formatUsd(account.pendingMicroUsd));
const destination = $derived(
	account.fundingWalletAddress
		? shortAddress(account.fundingWalletAddress)
		: 'the funding wallet'
);

function open(kind: WithdrawalConfirm): void {
	failure = null;
	confirming = kind;
}

function close(): void {
	confirming = null;
}

function submitConfirm(event: SubmitEvent): void {
	event.preventDefault();
	failure = null;
	const onError = (error: Error) => {
		failure = userErrorMessage(error);
	};
	if (confirming === 'cancel') {
		withdrawal.cancel.mutate(
			{ funder: source.funder },
			{ onSuccess: close, onError }
		);
	} else if (confirming === 'complete') {
		withdrawal.complete.mutate(
			{ funder: source.funder },
			{ onSuccess: close, onError }
		);
	}
}
</script>

{#if rows.length > 0}
	<SettingsSection title="Pending">
		<PendingEscrowTable
			{rows}
			{delayed}
			{actionReason}
			onCancel={() => open('cancel')}
			onComplete={() => open('complete')}
		/>
	</SettingsSection>
{/if}

<ChipModalConfirm
	bind:open={() => confirming === 'cancel', (next) => !next && close()}
	title="Cancel the withdrawal"
	text={`${pendingAmount} goes back to your available balance.`}
	pending={withdrawal.cancel.isPending}
	error={failure}
	onsubmit={submitConfirm}
>
	{#snippet confirm()}
		<Chip type="submit" variant="primary" loading={withdrawal.cancel.isPending}>
			Cancel withdrawal
		</Chip>
	{/snippet}
</ChipModalConfirm>

<ChipModalConfirm
	bind:open={() => confirming === 'complete', (next) => !next && close()}
	title={`Send ${pendingAmount} to ${destination}`}
	pending={withdrawal.complete.isPending}
	error={failure}
	onsubmit={submitConfirm}
>
	<KeyValueRow align="end" label="Amount" value={pendingAmount} />
	<KeyValueRow align="end" label="To" value={destination} />
	{#snippet confirm()}
		<Chip
			type="submit"
			variant="primary"
			loading={withdrawal.complete.isPending}
		>
			Complete withdrawal
		</Chip>
	{/snippet}
</ChipModalConfirm>
