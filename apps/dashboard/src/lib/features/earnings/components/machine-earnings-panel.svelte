<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
import MoreHorizontal from '@lucide/svelte/icons/ellipsis';
import History from '@lucide/svelte/icons/history';
import type {
	HostEscrowBalance,
	HostMachineEarnings,
} from '@snapflow/api-client';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import ResourceDetailsPanel from '#lib/components/resource/resource-details-panel.svelte';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import ResourceRowActionItems from '#lib/components/resource/resource-row-action-items.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import AddressDisplay from '#lib/components/ui/address/address-display.svelte';
import DropdownMenu from '#lib/components/ui/dropdown-menu/dropdown-menu.svelte';
import DropdownMenuContent from '#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
import DropdownMenuTrigger from '#lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
import IconButton from '#lib/components/ui/icon-button.svelte';
import Meter from '#lib/components/ui/meter.svelte';
import Money from '#lib/components/ui/money.svelte';
import StatusLabel from '#lib/components/ui/status/status-label.svelte';
import {
	belowMinimumLabel,
	shortDate,
} from '#lib/features/earnings/lib/earnings-copy.ts';
import {
	claimDeadlineSoon,
	EARNINGS_STATUS,
	machineEarningsStatus,
	PAYOUT_PERCENT_SCALE,
	payoutProgressPercent,
	statusLabelProps,
} from '#lib/features/earnings/lib/earnings-status.ts';
import { formatDateTime } from '#lib/utils/format.ts';
import { goto } from '$app/navigation';

interface MachineEarningsPanelProps {
	machine: HostMachineEarnings | null;
	balance: HostEscrowBalance | undefined;
	href: string | undefined;
	onClose: () => void;
	onPrevious?: () => void;
	onNext?: () => void;
	onShowPayouts: (machineId: string) => void;
}

let {
	machine,
	balance,
	href,
	onClose,
	onPrevious,
	onNext,
	onShowPayouts,
}: MachineEarningsPanelProps = $props();

const progress = $derived(machine ? payoutProgressPercent(machine) : null);
const actions = $derived.by((): ResourceRowAction[] => {
	if (!machine) return [];
	const { machineId } = machine;
	const machineHref = href;
	return [
		{
			icon: ArrowUpRight,
			label: 'Open machine',
			visible: machineHref !== undefined,
			onSelect: () => {
				if (machineHref) void goto(machineHref);
			},
		},
		{
			icon: History,
			label: 'View payouts',
			onSelect: () => onShowPayouts(machineId),
		},
	];
});
const deadlineSoon = $derived(
	machine && balance
		? claimDeadlineSoon(machine, balance.claimDeadlineNoticeSeconds, Date.now())
		: false
);
</script>

{#snippet panelActions()}
	{#if machine}
		<DropdownMenu>
			<DropdownMenuTrigger>
				{#snippet child({ props })}
					<IconButton
						{...props}
						variant="ghost"
						label="Machine actions"
						icon={MoreHorizontal}
					/>
				{/snippet}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<ResourceRowActionItems {actions} />
			</DropdownMenuContent>
		</DropdownMenu>
	{/if}
{/snippet}

<ResourceDetailsPanel
	open={machine !== null}
	title={machine?.machineName ?? 'Machine'}
	{onClose}
	{onPrevious}
	{onNext}
	actions={panelActions}
>
	{#if machine}
		<div class="flex flex-col gap-y-8 pt-2">
			<SettingsSection title="Payout">
				<KeyValueList framed={false}>
					<KeyValueRow label="State">
						<StatusLabel
							{...statusLabelProps(machineEarningsStatus(machine))}
						/>
					</KeyValueRow>
					<KeyValueRow
						label={EARNINGS_STATUS.earning.label}
						info={EARNINGS_STATUS.earning.description}
					>
						<Money microUsd={machine.unclaimedMicroUsd} />
					</KeyValueRow>
					<KeyValueRow
						label={EARNINGS_STATUS.ready.label}
						info={EARNINGS_STATUS.ready.description}
					>
						<Money microUsd={machine.creditedMicroUsd} />
					</KeyValueRow>
					<KeyValueRow label="Not paid out">
						<Money microUsd={machine.pendingMicroUsd} />
					</KeyValueRow>
					<KeyValueRow label="Paid out">
						<Money microUsd={machine.withdrawnMicroUsd} />
					</KeyValueRow>
					{#if progress !== null}
						<KeyValueRow label="Payout progress">
							<span class="inline-flex items-center gap-3">
								<Meter
									variant="compact"
									class="w-16 shrink-0"
									label="Progress to the next payout"
									value={progress}
									maximum={PAYOUT_PERCENT_SCALE}
									valueText={`${progress}%`}
									tone="default"
								/>
								<span class="tabular-nums">{progress}%</span>
							</span>
						</KeyValueRow>
					{/if}
					<KeyValueRow label="Next payout">
						{#if machine.payoutDue && machine.netPayoutMicroUsd}
							<span class="inline-flex items-baseline gap-2">
								<Money microUsd={machine.netPayoutMicroUsd} />
								{#if machine.nextPayoutAt}
									<span class="text-(--text-muted)">
										{shortDate(machine.nextPayoutAt)}
									</span>
								{/if}
							</span>
						{:else if balance}
							<span class="text-(--text-muted)">
								{belowMinimumLabel(balance.payoutMinimumMicroUsd)}
							</span>
						{/if}
					</KeyValueRow>
					{#if machine.relayFeeMicroUsd}
						<KeyValueRow label="Network fee">
							<Money microUsd={machine.relayFeeMicroUsd} precise />
						</KeyValueRow>
					{:else}
						<KeyValueRow label="Network fee" value={null} />
					{/if}
					{#if deadlineSoon && machine.claimDeadlineAt}
						<KeyValueRow label="Deadline">
							<span class="text-(--warning)">
								{`Settled by ${formatDateTime(machine.claimDeadlineAt)}`}
							</span>
						</KeyValueRow>
					{/if}
				</KeyValueList>
			</SettingsSection>
			<SettingsSection title="Keys">
				<KeyValueList framed={false}>
					<KeyValueRow label="Machine key">
						<AddressDisplay value={machine.hostAddress} />
					</KeyValueRow>
					{#if machine.payoutAddress}
						<KeyValueRow label="Pays to">
							<AddressDisplay value={machine.payoutAddress} />
						</KeyValueRow>
					{:else}
						<KeyValueRow label="Pays to" value={null} />
					{/if}
				</KeyValueList>
			</SettingsSection>
		</div>
	{/if}
</ResourceDetailsPanel>
