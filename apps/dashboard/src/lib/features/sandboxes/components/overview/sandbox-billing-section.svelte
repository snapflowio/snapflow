<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { SandboxBillingSummaryDto } from '@snapflow/api-client';

const ACTIVE_BILLING_STATE: SandboxBillingSummaryDto['state'] = 'active';
const UNKNOWN_FUNDING_STATE = 'unknown';

type CompleteBilling = SandboxBillingSummaryDto &
	Required<
		Pick<
			SandboxBillingSummaryDto,
			| 'assignmentGeneration'
			| 'estimatedHourlyMicroUsd'
			| 'liveAccrualMicroUsd'
			| 'placementId'
			| 'remainingReservedMicroUsd'
			| 'reservationExpiresAt'
		>
	>;

function isCompleteBilling(
	billing: SandboxBillingSummaryDto
): billing is CompleteBilling {
	return (
		Boolean(billing.placementId) &&
		billing.assignmentGeneration !== undefined &&
		billing.estimatedHourlyMicroUsd !== undefined &&
		billing.liveAccrualMicroUsd !== undefined &&
		billing.remainingReservedMicroUsd !== undefined &&
		Boolean(billing.reservationExpiresAt)
	);
}
</script>

<script lang="ts">
import FeedbackState from '#lib/components/feedback-state.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import { formatDateTime } from '#lib/utils/format.ts';
import { titleCase } from '#lib/utils/text.ts';
import { formatMicroUsd } from '#lib/utils/usd.ts';

interface SandboxBillingSectionProps {
	billing: SandboxBillingSummaryDto | undefined;
	loading: boolean;
	unavailable: boolean;
}

let { billing, loading, unavailable }: SandboxBillingSectionProps = $props();

const completeBilling = $derived(
	!loading &&
		!unavailable &&
		billing?.state === ACTIVE_BILLING_STATE &&
		isCompleteBilling(billing)
		? billing
		: null
);
</script>

{#snippet notice(
	noticeTitle: string,
	noticeDescription: string
)}
	<Notice tone="warning">
		{#snippet title()}
			{noticeTitle}
		{/snippet}
		{#snippet description()}
			{noticeDescription}
		{/snippet}
	</Notice>
{/snippet}

{#snippet row(
	rowLabel: string,
	rowValue: string,
	rowDetail?: string
)}
	<KeyValueRow detail={rowDetail ? detail : undefined}>
		{#snippet label()}
			{rowLabel}
		{/snippet}
		{#snippet value()}
			{rowValue}
		{/snippet}
	</KeyValueRow>
	{#snippet detail()}
		{rowDetail}
	{/snippet}
{/snippet}

<SettingsSection
	title="Billing"
	description={completeBilling
		? 'Live accrual is an estimate; posted billing lines are authoritative.'
		: undefined}
>
	{#if loading}
		<FeedbackState class="min-h-0 py-4" message="Loading..." />
	{:else if unavailable}
		{@render notice(
			'Billing details are temporarily unavailable',
			'Current pricing and reservation could not be loaded.'
		)}
	{:else if billing?.state !== ACTIVE_BILLING_STATE}
		<FeedbackState
			class="min-h-0 py-4"
			message="Pricing appears after a machine accepts this sandbox"
		/>
	{:else if !completeBilling}
		{@render notice(
			'Billing details are incomplete',
			'New lifecycle operations fail closed until the placement authorization is repaired.'
		)}
	{:else}
		<KeyValueList>
			{@render row(
				'Accepted hourly rate',
				`${formatMicroUsd(completeBilling.estimatedHourlyMicroUsd)}/hr`,
				'Fixed for this assignment'
			)}
			{@render row(
				'Live accrual',
				formatMicroUsd(completeBilling.liveAccrualMicroUsd)
			)}
			{@render row(
				'Reserved runway',
				formatMicroUsd(completeBilling.remainingReservedMicroUsd)
			)}
			{@render row(
				'Funding state',
				titleCase(completeBilling.fundingState ?? UNKNOWN_FUNDING_STATE),
				completeBilling.billingCutoffAt
					? `Billing cutoff ${formatDateTime(completeBilling.billingCutoffAt)}`
					: undefined
			)}
			{@render row(
				'Assignment generation',
				completeBilling.assignmentGeneration.toString(),
				completeBilling.placementId
			)}
			{@render row(
				'Reservation renewal',
				formatDateTime(completeBilling.reservationExpiresAt)
			)}
		</KeyValueList>
	{/if}
</SettingsSection>
