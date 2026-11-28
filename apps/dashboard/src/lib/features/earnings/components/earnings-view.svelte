<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ArrowRight from '@lucide/svelte/icons/arrow-right';
import FileText from '@lucide/svelte/icons/file-text';
import HandCoins from '@lucide/svelte/icons/hand-coins';
import PageSection from '#lib/components/detail/page-section.svelte';
import StatusBlock from '#lib/components/detail/status-block.svelte';
import FeedbackState from '#lib/components/feedback-state.svelte';
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import PageColumn from '#lib/components/page/page-column.svelte';
import ResourceFilterChips from '#lib/components/resource/filter/resource-filter-chips.svelte';
import type { ResourceFilterTag } from '#lib/components/resource/resource-options.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipSwitch from '#lib/components/ui/chip/chip-switch.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import {
	EARNINGS_PANEL_PARAM,
	EARNINGS_SEGMENTS,
	EarningsView,
	isEarningsView,
} from '#lib/features/earnings/lib/earnings-params.ts';
import { EarningsPage } from '#lib/features/earnings/state/earnings-page.svelte.ts';
import { PayoutHistory } from '#lib/features/earnings/state/payout-history.svelte.ts';
import { machineListingHref } from '#lib/features/machines/lib/machine-listing-link.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { shortAddress } from '#lib/features/wallet/lib/payment-wallet.ts';
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';
import ChangePayoutWalletModal from './change-payout-wallet-modal.svelte';
import EarningsWells from './earnings-wells.svelte';
import ExportStatementModal from './export-statement-modal.svelte';
import MachineEarningsPanel from './machine-earnings-panel.svelte';
import MachineEarningsTable from './machine-earnings-table.svelte';
import PayoutHistoryTable from './payout-history.svelte';

const MACHINE_FILTER_FIELD = 'Machine';

const page = new EarningsPage();
const history = new PayoutHistory(() => page.machineFilter);
const permission = getOrganizationPermission();
const canAddMachine = $derived(permission.can({ machines: ['write'] }));
const panel = new OpenRowParam(
	() => page.balance.data?.machines ?? [],
	(machine) => machine.hostAddress,
	{ param: EARNINGS_PANEL_PARAM }
);

const filteredMachineName = $derived.by(() => {
	const machineId = page.machineFilter;
	if (!machineId) return null;
	return (
		page.balance.data?.machines.find(
			(machine) => machine.machineId === machineId
		)?.machineName ?? machineId
	);
});
const filterTags = $derived<ResourceFilterTag[]>(
	page.view === EarningsView.Payouts && filteredMachineName
		? [
				{
					field: MACHINE_FILTER_FIELD,
					value: filteredMachineName,
					onRemove: page.clearMachineFilter,
				},
			]
		: []
);
const actions: HeaderAction[] = [
	{
		id: 'export',
		kind: 'secondary',
		label: 'Export statement',
		icon: FileText,
		onSelect: () => (page.exporting = true),
	},
];
</script>

{#snippet historyActions()}
	<ResourceFilterChips {filterTags} />
	<ChipSwitch
		aria-label="History view"
		size="compact"
		options={EARNINGS_SEGMENTS}
		value={page.view}
		onChange={(value) => {
			if (isEarningsView(value)) page.setView(value);
		}}
	/>
{/snippet}

{#snippet setUpAction()}
	<Chip
		variant="primary"
		rightIcon={ArrowRight}
		disabledReason={page.manageReason}
		onclick={page.openWalletChange}
	>
		Set payout wallet
	</Chip>
{/snippet}

<PageColumn
	title="Earnings"
	{actions}
	pending={page.balance.isFetching && page.balance.data !== undefined}
	class="gap-y-8"
>
	{#if page.firstRun}
		<StatusBlock
			icon={HandCoins}
			title="Set up payouts"
			description="Machines can be listed publicly once a payout wallet is set."
			actions={setUpAction}
		/>
	{:else if page.balance.isError && !page.balance.data}
		<FeedbackState
			variant="inline"
			tone="error"
			resource="earnings"
			error={page.balance.error}
			retrying={page.balance.isFetching}
			onRetry={() => void page.balance.refetch()}
		/>
	{:else}
		<EarningsWells
			balance={page.balance.data}
			next={page.next}
			wallet={page.wallet}
			manageReason={page.manageReason}
			onChange={page.openWalletChange}
		/>
	{/if}

	<PageSection title="History" actions={historyActions}>
		{#if page.view === EarningsView.Machines}
			<MachineEarningsTable
				balance={page.balance.data}
				isLoading={page.balance.isLoading}
				isFetching={page.balance.isFetching}
				errorMessage={page.balance.isError && !page.balance.data
					? "Couldn't load machine earnings"
					: undefined}
				{canAddMachine}
				addMachineHref={resolve(Path.MACHINES_ADD)}
				selectedRowId={panel.openId}
				onOpen={panel.open}
				onRetry={() => void page.balance.refetch()}
				onShowPayouts={page.showMachinePayouts}
			/>
		{:else}
			<PayoutHistoryTable
				{history}
				filtered={page.machineFilter !== null}
				onClearFilter={page.clearMachineFilter}
			/>
		{/if}
	</PageSection>
</PageColumn>

{#if page.view === EarningsView.Machines}
	<MachineEarningsPanel
		machine={panel.row}
		balance={page.balance.data}
		href={panel.row ? machineListingHref(panel.row.machineId) : undefined}
		onClose={panel.close}
		onPrevious={panel.previous}
		onNext={panel.next}
		onShowPayouts={page.showMachinePayouts}
	/>
{/if}

<ChangePayoutWalletModal
	open={page.changingWallet}
	current={page.wallet}
	onClose={() => (page.changingWallet = false)}
	onUnlink={page.canManage ? page.requestUnlink : undefined}
/>
<ExportStatementModal
	open={page.exporting}
	onClose={() => (page.exporting = false)}
/>
<ChipModalConfirm
	bind:open={page.unlinking}
	title="Unlink payout wallet"
	text={page.wallet
		? [
				{ text: shortAddress(page.wallet.address), bold: true },
				' stops receiving payouts. ',
				{ text: 'Public listings stop taking rentals.', error: true },
			]
		: ''}
	cancelLabel="Keep wallet"
	pending={page.unlinkPending}
	error={page.unlinkError}
	onsubmit={page.confirmUnlink}
>
	{#snippet confirm()}
		<Chip type="submit" variant="destructive" loading={page.unlinkPending}>
			Unlink
		</Chip>
	{/snippet}
</ChipModalConfirm>
