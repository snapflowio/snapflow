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
	type AutoTopUp,
	AutoTopUpStatus,
	type BillingBudgetDto,
	type EscrowSignerGrant,
	EscrowSignerStatus,
} from '@snapflow/api-client';
import type {
	StatusRingShape,
	StatusRingTone,
} from '#lib/components/ui/status/status-ring.svelte';
import { formatDate } from '#lib/utils/format.ts';
import { formatHourlyPrice, formatUsd } from '#lib/utils/usd.ts';

interface RowStatus {
	label: string;
	shape: StatusRingShape;
	tone: StatusRingTone;
}

const BUDGET_MODE_LABELS = {
	alert: 'Warn only',
	block_new: 'Block new sandboxes',
} as const satisfies Record<BillingBudgetDto['mode'], string>;
const NO_LIMIT_LABEL = 'No limit';
const AUTO_TOP_UP_DESCRIPTION =
	'Refills the escrow from the funding wallet when the balance runs low.';
const AUTOMATIC_PAYMENTS_DESCRIPTION =
	'Pays your hosts from the escrow, up to an hourly limit.';
const SPEND_LIMIT_DESCRIPTION =
	'Warns you or stops new sandboxes once the month reaches it.';

function autoTopUpStatus(settings: AutoTopUp): RowStatus {
	const terms = `${formatUsd(settings.amount)} when below ${formatUsd(settings.threshold)}`;
	switch (settings.status) {
		case AutoTopUpStatus.Active:
			return { label: `On · ${terms}`, shape: 'check', tone: 'success' };
		case AutoTopUpStatus.Failing:
			return { label: `Failing · ${terms}`, shape: 'cross', tone: 'error' };
		case AutoTopUpStatus.NotAuthorized:
			return {
				label: 'Waiting for the wallet',
				shape: 'alert',
				tone: 'warning',
			};
		case AutoTopUpStatus.Disabled:
			return { label: 'Off', shape: 'empty', tone: 'neutral' };
	}
}

function autoTopUpInfo(settings: AutoTopUp): string | undefined {
	const limits = settings.limits;
	const parts = [
		limits?.lastTopUpAt
			? `Last top-up ${formatDate(limits.lastTopUpAt)}`
			: null,
		limits?.nextTopUpAt ? `next from ${formatDate(limits.nextTopUpAt)}` : null,
	].filter((part) => part !== null);
	return parts.length > 0 ? parts.join(' · ') : undefined;
}

function signerStatus(grant: EscrowSignerGrant | null): RowStatus {
	if (!grant) return { label: 'Off', shape: 'empty', tone: 'neutral' };
	switch (grant.status) {
		case EscrowSignerStatus.Active:
			return {
				label: `Up to ${formatHourlyPrice(grant.hourlyCap)}`,
				shape: 'check',
				tone: 'success',
			};
		case EscrowSignerStatus.Thawing:
			return { label: 'Stopping', shape: 'paused', tone: 'warning' };
		case EscrowSignerStatus.Revocable:
			return { label: 'Stopped', shape: 'paused', tone: 'warning' };
		case EscrowSignerStatus.Revoked:
			return { label: 'Off · key revoked', shape: 'empty', tone: 'neutral' };
		case EscrowSignerStatus.Expired:
			return { label: 'Expired', shape: 'cross', tone: 'error' };
	}
}
</script>

<script lang="ts">
import Power from '@lucide/svelte/icons/power';
import { createMutation } from '@tanstack/svelte-query';
import { getAddress } from 'viem';
import {
	disableAutoTopUpMutationOptions,
	revokeSignerMutationOptions,
	thawSignerMutationOptions,
} from '#lib/api/settlement/escrow-writes.ts';
import Trash from '#lib/components/icons/trash.svelte';
import {
	hasVisibleRowActions,
	type ResourceRowAction,
} from '#lib/components/resource/resource-row-action.ts';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import SettingsRow from '#lib/components/settings/settings-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import StatusLabel from '#lib/components/ui/status/status-label.svelte';
import { formatSeconds } from '#lib/features/billing/lib/escrow-terms.ts';
import type { BillingFunding } from '#lib/features/billing/state/billing-funding.svelte.ts';
import type { BillingDialogs } from '#lib/features/billing/state/funding-dialog-request.svelte.ts';
import { FundingDialog } from '#lib/routing/funding-dialog.ts';

type PaymentsConfirm = 'auto-top-up-off' | 'stop-payments' | 'revoke-key';

interface PaymentsSectionProps {
	funding: BillingFunding;
	dialogs: BillingDialogs;
}

let { funding, dialogs }: PaymentsSectionProps = $props();

const disable = createMutation(() => disableAutoTopUpMutationOptions());
const thaw = createMutation(() => thawSignerMutationOptions());
const revoke = createMutation(() => revokeSignerMutationOptions());
let confirming = $state<PaymentsConfirm | null>(null);

const canManage = $derived(funding.canManage);
const signReason = $derived(
	funding.signing ? null : funding.source.hintFor(canManage)
);
const autoTopUp = $derived(funding.autoTopUp.data);
const delegation = $derived(funding.delegation.data);
const grant = $derived(delegation?.delegatedSigner ?? null);
const budget = $derived(funding.budget.data);
const limit = $derived(funding.overview.data?.month.limitMicroUsd);
const spendStatus = $derived.by((): RowStatus => {
	if (limit === undefined) {
		return { label: NO_LIMIT_LABEL, shape: 'empty', tone: 'neutral' };
	}
	const mode = budget ? ` · ${BUDGET_MODE_LABELS[budget.mode]}` : '';
	return {
		label: `${formatUsd(limit)}/mo${mode}`,
		shape: 'check',
		tone: 'success',
	};
});
const signerInfo = $derived.by((): string | undefined => {
	if (!delegation) return undefined;
	const thaw = `Lowering the limit takes ${formatSeconds(delegation.windows.signerThawSeconds)}.`;
	return grant?.status === EscrowSignerStatus.Active
		? `Expires ${formatDate(grant.expiresAt)}. ${thaw}`
		: thaw;
});
const signerAddress = $derived(
	grant?.signerAddress ?? delegation?.delegatedSignerAddress ?? null
);
const autoTopUpActions = $derived<ResourceRowAction[]>([
	{
		label: 'Turn off',
		icon: Power,
		destructive: true,
		visible: Boolean(autoTopUp?.enabled),
		disabledReason: signReason ?? undefined,
		onSelect: () => {
			confirming = 'auto-top-up-off';
		},
	},
]);
const signerActions = $derived<ResourceRowAction[]>([
	{
		label: 'Stop automatic payments',
		icon: Power,
		destructive: true,
		visible: grant?.status === EscrowSignerStatus.Active,
		disabledReason: signReason ?? undefined,
		onSelect: () => {
			confirming = 'stop-payments';
		},
	},
	{
		label: 'Revoke key',
		icon: Trash,
		destructive: true,
		visible:
			grant?.status === EscrowSignerStatus.Thawing ||
			grant?.status === EscrowSignerStatus.Revocable,
		disabledReason:
			grant?.status === EscrowSignerStatus.Thawing
				? 'Available once the key stops'
				: (signReason ?? undefined),
		onSelect: () => {
			confirming = 'revoke-key';
		},
	},
]);

function closeConfirm(): void {
	confirming = null;
}

function turnOffAutoTopUp(event: SubmitEvent): void {
	event.preventDefault();
	if (!funding.signing || disable.isPending) return;
	disable.mutate(
		{ funder: funding.source.funder },
		{ onSuccess: closeConfirm }
	);
}

function changeSigner(event: SubmitEvent): void {
	event.preventDefault();
	if (!(funding.signing && signerAddress)) return;
	const variables = {
		funder: funding.source.funder,
		signer: getAddress(signerAddress),
	};
	if (confirming === 'stop-payments') {
		thaw.mutate(variables, { onSuccess: closeConfirm });
	} else if (confirming === 'revoke-key') {
		revoke.mutate(variables, { onSuccess: closeConfirm });
	}
}
</script>

{#snippet change(dialog: FundingDialog, ready: boolean)}
	{#if canManage}
		<Chip
			size="compact"
			variant="secondary"
			disabled={!ready}
			disabledReason={signReason}
			onclick={() => dialogs.show(dialog)}
		>
			Change
		</Chip>
	{/if}
{/snippet}

{#snippet trailing(label: string, actions: readonly ResourceRowAction[])}
	{#if canManage && hasVisibleRowActions(actions)}
		<ResourceRowActions {label} {actions} reveal="always" />
	{/if}
{/snippet}

{#snippet status(row: RowStatus)}
	<StatusLabel
		class="max-w-full"
		label={row.label}
		shape={row.shape}
		tone={row.tone}
	/>
{/snippet}

<SettingsSection
	title="Payments"
	description={canManage ? (signReason ?? undefined) : undefined}
>
	<SettingsRow
		label="Auto top-up"
		description={AUTO_TOP_UP_DESCRIPTION}
		info={autoTopUp ? autoTopUpInfo(autoTopUp) : undefined}
	>
		<span class="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
			{#if autoTopUp}
				{@render status(autoTopUpStatus(autoTopUp))}
			{/if}
			{@render trailing('Auto top-up actions', autoTopUpActions)}
			{@render change(FundingDialog.AutoTopUp, funding.autoTopUp.isSuccess)}
		</span>
	</SettingsRow>
	<SettingsRow
		label="Automatic payments"
		description={AUTOMATIC_PAYMENTS_DESCRIPTION}
		info={signerInfo}
	>
		<span class="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
			{#if delegation}
				{@render status(signerStatus(grant))}
			{/if}
			{@render trailing('Automatic payments actions', signerActions)}
			{@render change(
				FundingDialog.AutomaticPayments,
				funding.delegation.isSuccess
			)}
		</span>
	</SettingsRow>
	<SettingsRow label="Spend limit" description={SPEND_LIMIT_DESCRIPTION}>
		<span class="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
			{@render status(spendStatus)}
			{#if canManage}
				<Chip
					size="compact"
					variant="secondary"
					disabled={!funding.budget.isSuccess}
					onclick={() => dialogs.show(FundingDialog.SpendLimits)}
				>
					Change
				</Chip>
			{/if}
		</span>
	</SettingsRow>
</SettingsSection>

<ChipModalConfirm
	bind:open={
		() => confirming === 'auto-top-up-off',
		(open) => {
	if (!open) closeConfirm();
}
	}
	title="Turn off auto top-up"
	text={[
		'Snapflow stops refilling the escrow from the funding wallet. ',
		{
			text: 'Running sandboxes stop when the balance runs out unless you deposit more.',
			error: true,
		},
	]}
	pending={disable.isPending}
	onsubmit={turnOffAutoTopUp}
>
	{#snippet confirm()}
		<Chip type="submit" variant="destructive" loading={disable.isPending}>
			Turn off
		</Chip>
	{/snippet}
</ChipModalConfirm>

<ChipModalConfirm
	bind:open={
		() => confirming === 'stop-payments' || confirming === 'revoke-key',
		(open) => {
	if (!open) closeConfirm();
}
	}
	title={confirming === 'revoke-key'
		? 'Revoke the payment key'
		: 'Stop automatic payments'}
	text={confirming === 'revoke-key'
		? [
				'The key can never pay again. ',
				{
					text: 'Running sandboxes are held once their payments fall behind.',
					error: true,
				},
			]
		: [
				'Snapflow stops paying hosts with this key now. ',
				{
					text: delegation
						? `Running sandboxes are held once payments fall behind. You can revoke the key after ${formatSeconds(delegation.windows.signerThawSeconds)}.`
						: 'Running sandboxes are held once payments fall behind.',
					error: true,
				},
			]}
	pending={thaw.isPending || revoke.isPending}
	onsubmit={changeSigner}
>
	{#snippet confirm()}
		<Chip
			type="submit"
			variant="destructive"
			loading={thaw.isPending || revoke.isPending}
		>
			{confirming === 'revoke-key' ? 'Revoke key' : 'Stop payments'}
		</Chip>
	{/snippet}
</ChipModalConfirm>
