<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { type Machine, SandboxClass } from '@snapflow/api-client';
import {
	type MachineAllocation,
	machineDiskAllocation,
	machineMemoryAllocation,
} from '#lib/features/machines/lib/machine-format.ts';
import { sandboxClassLabel } from '#lib/features/sandboxes/lib/sandbox-state.ts';
import { formatCount } from '#lib/utils/format.ts';

const NEVER_CHECKED = 'Never';

interface CapacityRow {
	label: string;
	allocation: MachineAllocation;
}

function capacityRows(machine: Machine): CapacityRow[] {
	return [
		{ label: 'Memory', allocation: machineMemoryAllocation(machine) },
		{ label: 'Disk', allocation: machineDiskAllocation(machine) },
	];
}
</script>

<script lang="ts">
import Globe from '@lucide/svelte/icons/globe';
import { createQuery } from '@tanstack/svelte-query';
import { hostEscrowBalanceQueryOptions } from '#lib/api/settlement/escrow.ts';
import DetailCell from '#lib/components/detail/detail-cell.svelte';
import DetailGrid from '#lib/components/detail/detail-grid.svelte';
import DetailItem from '#lib/components/detail/detail-item.svelte';
import DetailSection from '#lib/components/detail/detail-section.svelte';
import WidgetCell from '#lib/components/detail/widget-cell.svelte';
import WidgetRow from '#lib/components/detail/widget-row.svelte';
import PageColumn from '#lib/components/page/page-column.svelte';
import { EMPTY_CELL_PLACEHOLDER } from '#lib/components/resource/table/resource-table.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import CopyableText from '#lib/components/ui/clipboard/copyable-text.svelte';
import Meter from '#lib/components/ui/meter.svelte';
import Money from '#lib/components/ui/money.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import { belowMinimumLabel } from '#lib/features/earnings/lib/earnings-copy.ts';
import { earningsViewHref } from '#lib/features/earnings/lib/earnings-links.ts';
import { EarningsView } from '#lib/features/earnings/lib/earnings-params.ts';
import { locationLabel } from '#lib/features/locations/lib/location-format.ts';
import { machineAttention } from '#lib/features/machines/lib/machine-attention.ts';
import { machineCpuAllocation } from '#lib/features/machines/lib/machine-format.ts';
import { machineListingHref } from '#lib/features/machines/lib/machine-listing-link.ts';
import { listsPublicly } from '#lib/features/machines/lib/machine-listing-status.ts';
import { HostPayoutReadiness } from '#lib/features/machines/state/host-payout-readiness.svelte.ts';
import { getMachineDetail } from '#lib/features/machines/state/machine-detail.svelte.ts';
import { resolve } from '$app/paths';

const detail = getMachineDetail();
const payout = new HostPayoutReadiness();
const balance = createQuery(() => ({
	...hostEscrowBalanceQueryOptions(),
	enabled: payout.canRead,
}));
const machine = $derived(detail.machine);
const cpu = $derived(machineCpuAllocation(machine));
const rows = $derived(capacityRows(machine));
const attention = $derived(machineAttention(machine, detail.trust.data));
const earnings = $derived(
	(balance.data?.machines ?? []).filter(
		(entry) => entry.machineId === machine.id
	)
);
const pendingTotal = $derived(
	earnings
		.reduce((total, entry) => total + BigInt(entry.pendingMicroUsd), 0n)
		.toString()
);
const paidTotal = $derived(
	earnings
		.reduce((total, entry) => total + BigInt(entry.withdrawnMicroUsd), 0n)
		.toString()
);
const nextPayout = $derived(
	earnings.find((entry) => entry.payoutDue && entry.netPayoutMicroUsd)
);
const canListPublicly = $derived(
	detail.canWriteListings &&
		detail.host !== undefined &&
		!listsPublicly(detail.host) &&
		detail.host.currentPriceCard !== null &&
		payout.ready === true
);

detail.usePageActions(() =>
	canListPublicly
		? [
				{
					id: 'list-publicly',
					kind: 'primary',
					label: 'List publicly',
					icon: Globe,
					href: machineListingHref(machine.id),
				},
			]
		: []
);
</script>

{#snippet healthAction()}
	<Chip
		size="compact"
		variant="secondary"
		href={resolve('/(app)/(dashboard)/machines/[machineId]/health', {
			machineId: machine.id,
		})}
	>
		Open health
	</Chip>
{/snippet}

{#snippet cpuHeadline()}
	<span class="tabular-nums">{formatCount(cpu.allocated)}</span>
	<span class="text-(--text-muted) text-base">
		of {formatCount(cpu.total)} vCPU
	</span>
	<Meter
		class="mt-3"
		label="CPU allocated"
		value={cpu.allocated}
		maximum={cpu.total}
		valueText={cpu.label}
	/>
{/snippet}

{#snippet sandboxesHeadline()}
	<span class="tabular-nums">
		{formatCount(machine.currentStartedSandboxes ?? 0)}
	</span>
	<span class="text-(--text-muted) text-base">running</span>
{/snippet}

{#snippet earningsHeadline()}
	<Money microUsd={pendingTotal} />
{/snippet}

<PageColumn class="gap-y-12">
	{#if attention}
		<Notice
			tone={attention.tone}
			title={attention.title}
			info={attention.info}
			action={attention.tone === 'info' ? undefined : healthAction}
		/>
	{/if}

	<WidgetRow label="Machine overview">
		<WidgetCell title="Capacity" headline={cpuHeadline}>
			<dl class="flex flex-col">
				{#each rows as row (row.label)}
					<DetailItem label={row.label} value={row.allocation.label} />
				{/each}
			</dl>
		</WidgetCell>
		<WidgetCell title="Workload" headline={sandboxesHeadline}>
			<dl class="flex flex-col">
				<DetailItem
					label="Snapshots"
					value={formatCount(machine.currentSnapshotCount ?? 0)}
				/>
			</dl>
		</WidgetCell>
		{#if payout.canRead}
			<WidgetCell
				title="Not paid out"
				href={earningsViewHref(EarningsView.Payouts, machine.id)}
				hrefLabel="View payouts"
				headline={earningsHeadline}
			>
				<dl class="flex flex-col">
					<DetailItem label="Paid out">
						<Money microUsd={paidTotal} />
					</DetailItem>
					<DetailItem label="Next payout">
						{#if nextPayout?.netPayoutMicroUsd}
							<Money microUsd={nextPayout.netPayoutMicroUsd} />
						{:else if balance.data}
							<span class="text-(--text-muted)">
								{belowMinimumLabel(balance.data.payoutMinimumMicroUsd)}
							</span>
						{:else}
							<span class="text-(--text-muted)">{EMPTY_CELL_PLACEHOLDER}</span>
						{/if}
					</DetailItem>
				</dl>
			</WidgetCell>
		{:else}
			<WidgetCell title="Location">
				<p class="text-(--text-primary) text-sm">
					{locationLabel(machine.location)}
				</p>
			</WidgetCell>
		{/if}
	</WidgetRow>

	<DetailSection title="Details" separated>
		<DetailGrid label="Machine details">
			<DetailCell label="Machine ID">
				<CopyableText value={machine.id} label="Copy machine ID" />
			</DetailCell>
			<DetailCell label="Location" value={locationLabel(machine.location)} />
			<DetailCell
				label="Class"
				value={sandboxClassLabel(machine.sandboxClass ?? SandboxClass.LinuxVm)}
			/>
			<DetailCell
				label="Version"
				mono
				value={machine.appVersion ?? machine.apiVersion}
			/>
			<DetailCell label="Last checked">
				{#if machine.lastChecked}
					<Timestamp value={machine.lastChecked} />
				{:else}
					<span class="text-(--text-subtle)">{NEVER_CHECKED}</span>
				{/if}
			</DetailCell>
			<DetailCell label="Registered">
				<Timestamp value={machine.createdAt} />
			</DetailCell>
		</DetailGrid>
	</DetailSection>
</PageColumn>
