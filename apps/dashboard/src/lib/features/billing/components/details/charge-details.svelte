<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { titleCase } from '#lib/utils/text.ts';
import { formatUsd } from '#lib/utils/usd.ts';

function formatRecord(record: Record<string, string>): string {
	return Object.entries(record)
		.map(([key, value]) => `${titleCase(key)}: ${value}`)
		.join(' · ');
}

function formatSignedMicroUsd(value: string): string {
	return `${BigInt(value) > 0n ? '+' : ''}${formatUsd(value)}`;
}
</script>

<script lang="ts">
import type { BillingLineItemDto } from '@snapflow/api-client';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import {
	billingEvidencePresentation,
	formatReconciliationReason,
} from '#lib/features/billing/lib/billing-evidence.ts';
import { formatServiceWindow } from '#lib/features/billing/lib/billing-usage.ts';
import { formatOptionalDateTime } from '#lib/utils/format.ts';
import DetailsCopyRow from './details-copy-row.svelte';
import DetailsField from './details-field.svelte';

interface ChargeDetailsProps {
	line: BillingLineItemDto;
}

let { line }: ChargeDetailsProps = $props();

const evidence = $derived(billingEvidencePresentation(line.evidenceStatus));
</script>

{#snippet row(
	rowLabel: string,
	rowValue: string,
	rowDetail?: string,
	valueClass?: string
)}
	{#snippet detail()}
		{rowDetail}
	{/snippet}
	<KeyValueRow detail={rowDetail ? detail : undefined}>
		{#snippet label()}
			{rowLabel}
		{/snippet}
		{#snippet value()}
			<span class={['block', valueClass]}>{rowValue}</span>
		{/snippet}
	</KeyValueRow>
{/snippet}

<div class="flex flex-col gap-2.5 pt-1">
	<div class="grid grid-cols-2 gap-x-3 pb-0.5">
		<DetailsField label="Charge" value={titleCase(line.chargeClass)} />
		<DetailsField label="Amount" value={formatUsd(line.effectiveMicroUsd)} />
	</div>
	<KeyValueList>
		<DetailsCopyRow label="Charge ID" value={line.id} />
		{@render row('Evidence', evidence.label, evidence.description)}
		{#if line.reconciliationReason}
			{@render row(
				'Review findings',
				formatReconciliationReason(line.reconciliationReason)
			)}
		{/if}
		{@render row(
			'Service window',
			formatServiceWindow(line.periodStart, line.periodEnd)
		)}
		{@render row(
			'Reconciled',
			formatOptionalDateTime(line.reconciledAt, 'Not yet reconciled')
		)}
	</KeyValueList>
	<KeyValueList>
		{@render row('Original', formatUsd(line.grossMicroUsd))}
		{#if BigInt(line.adjustmentMicroUsd) !== 0n}
			{@render row('Adjustment', formatSignedMicroUsd(line.adjustmentMicroUsd))}
		{/if}
		{@render row('Total', formatUsd(line.effectiveMicroUsd))}
	</KeyValueList>
	<KeyValueList>
		{@render row('Resource', line.resourceSku, `Machine ${line.machineId}`)}
		{@render row('Consumed', formatRecord(line.consumedQuantities))}
		{#if line.quantities}
			{@render row(
				'Priced quantities',
				formatRecord(line.quantities),
				line.leaseId ? `Lease ${line.leaseId}` : undefined
			)}
		{/if}
		{@render row(
			'Content digest',
			line.contentDigest,
			`${line.sourceType} · ${line.sourceId} · schema v${line.schemaVersion}`,
			'break-all font-mono text-caption'
		)}
	</KeyValueList>
</div>
