<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const PERCENT_MAXIMUM = 100;
const NO_RATES_REASON = 'Set rates first';
const LISTING_WRITE_REASON = 'Ask a member who manages listings';
const PAYOUT_MANAGE_REASON = 'Ask a member who manages payouts';
const MACHINE_HOUR_UNIT = 'hour';
</script>

<script lang="ts">
import ArrowRight from '@lucide/svelte/icons/arrow-right';
import Globe from '@lucide/svelte/icons/globe';
import Store from '@lucide/svelte/icons/store';
import { getWebsiteLinks } from '#lib/api/public-config.ts';
import DetailCell from '#lib/components/detail/detail-cell.svelte';
import DetailColumn from '#lib/components/detail/detail-column.svelte';
import DetailGrid from '#lib/components/detail/detail-grid.svelte';
import DetailItem from '#lib/components/detail/detail-item.svelte';
import DetailSection from '#lib/components/detail/detail-section.svelte';
import StatusBlock from '#lib/components/detail/status-block.svelte';
import FeedbackState from '#lib/components/feedback-state.svelte';
import PageColumn from '#lib/components/page/page-column.svelte';
import ResourceDetailsPanel from '#lib/components/resource/resource-details-panel.svelte';
import SettingsRow from '#lib/components/settings/settings-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import AddressDisplay from '#lib/components/ui/address/address-display.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipInputSuffix from '#lib/components/ui/chip/chip-input-suffix.svelte';
import ChipSwitch from '#lib/components/ui/chip/chip-switch.svelte';
import Meter from '#lib/components/ui/meter.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import Skeleton, {
	SKELETON_SECTION_ROWS,
} from '#lib/components/ui/skeleton/skeleton.svelte';
import Switch from '#lib/components/ui/switch.svelte';
import { formatTransferBytes } from '#lib/features/billing/lib/transfer.ts';
import ChangePayoutWalletModal from '#lib/features/earnings/components/change-payout-wallet-modal.svelte';
import { earningsViewHref } from '#lib/features/earnings/lib/earnings-links.ts';
import { EarningsView } from '#lib/features/earnings/lib/earnings-params.ts';
import {
	machineEarningsStatus,
	payoutProgressPercent,
	statusBadgeVariant,
} from '#lib/features/earnings/lib/earnings-status.ts';
import {
	formatRatePer,
	hostRateFields,
} from '#lib/features/host-pricing/lib/rate-fields.ts';
import ListPubliclyModal from '#lib/features/machines/components/listing/list-publicly-modal.svelte';
import MachineRatesModal from '#lib/features/machines/components/listing/machine-rates-modal.svelte';
import MachineVerificationSections from '#lib/features/machines/components/listing/machine-verification-sections.svelte';
import {
	LISTING_STATE_SWITCH,
	LISTING_VISIBILITY_SWITCH,
	listedState,
} from '#lib/features/machines/lib/host-listing.ts';
import {
	listsPublicly,
	machineListingStatusCopy,
} from '#lib/features/machines/lib/machine-listing-status.ts';
import { verificationSummary } from '#lib/features/machines/lib/machine-verification.ts';
import { getMachineDetail } from '#lib/features/machines/state/machine-detail.svelte.ts';
import {
	ListingBlocker,
	MachineListingState,
} from '#lib/features/machines/state/machine-listing.svelte.ts';
import { formatDateTime } from '#lib/utils/format.ts';

const detail = getMachineDetail();
const listing = new MachineListingState();
const machine = $derived(detail.machine);
const host = $derived(listing.host);
const status = $derived(host ? machineListingStatusCopy(host) : null);
const { hostTermsHref } = getWebsiteLinks();
const writeReason = $derived(
	listing.canWrite ? undefined : LISTING_WRITE_REASON
);
const currentKey = $derived(
	listing.earnings.find((earning) => earning.current) ?? listing.earnings[0]
);
const progress = $derived(
	currentKey ? payoutProgressPercent(currentKey) : null
);
const earningStatus = $derived(
	currentKey ? machineEarningsStatus(currentKey) : null
);
</script>

{#snippet editRatesAction()}
	<Chip
		variant="secondary"
		size="compact"
		disabledReason={writeReason}
		onclick={listing.editRates}
	>
		{host?.currentPriceCard ? 'Edit rates' : 'Set rates'}
	</Chip>
{/snippet}

{#snippet allPayoutsAction()}
	<Chip
		variant="ghost"
		size="compact"
		href={earningsViewHref(EarningsView.Payouts, machine.id)}
	>
		All payouts
	</Chip>
{/snippet}

{#snippet verificationAction()}
	{#if listing.verification.data}
		<Chip
			variant="ghost"
			size="compact"
			onclick={() => (listing.verificationOpen = true)}
		>
			Details
		</Chip>
	{/if}
{/snippet}

{#snippet capSuffix()}
	<ChipInputSuffix>GB/month</ChipInputSuffix>
{/snippet}

{#snippet setRatesNoticeAction()}
	<Chip
		variant="secondary"
		size="compact"
		disabledReason={writeReason}
		onclick={listing.editRates}
	>
		Set rates
	</Chip>
{/snippet}

{#snippet setWalletNoticeAction()}
	<Chip
		variant="secondary"
		size="compact"
		disabledReason={listing.payout.canManage ? undefined : PAYOUT_MANAGE_REASON}
		onclick={() => (listing.changingWallet = true)}
	>
		Set payout wallet
	</Chip>
{/snippet}

{#snippet termsNoticeAction()}
	<Chip
		variant="secondary"
		size="compact"
		href={hostTermsHref}
		target="_blank"
		rel="noopener noreferrer"
	>
		Host terms
	</Chip>
{/snippet}

{#snippet notListedAction()}
	<Chip variant="primary" rightIcon={ArrowRight} onclick={listing.openPublish}>
		List publicly
	</Chip>
{/snippet}

<div class="relative flex min-h-0 flex-1 flex-col">
	<PageColumn class="gap-y-12">
		{#if listing.loading}
			<Skeleton class="h-7" repeat={SKELETON_SECTION_ROWS} fade />
		{:else if listing.loadError && !host}
			<FeedbackState
				variant="inline"
				tone="error"
				resource="the listing"
				error={listing.loadError}
				onRetry={() => void detail.hostMachines.refetch()}
			/>
		{:else if !host}
			<StatusBlock
				icon={Store}
				title="Not listed yet"
				description="The listing appears once the machine reports its hardware."
			/>
		{:else}
			{#if listing.blocker === ListingBlocker.Rates}
				<Notice
					tone="warning"
					title="Set rates to list publicly"
					action={setRatesNoticeAction}
				/>
			{:else if listing.blocker === ListingBlocker.PayoutWallet}
				<Notice
					tone="warning"
					title="Set a screened payout wallet to list publicly"
					action={setWalletNoticeAction}
				/>
			{:else if listing.blocker === ListingBlocker.HostTerms}
				<Notice
					tone="warning"
					title="A member who manages listings must accept the host terms"
					action={termsNoticeAction}
				/>
			{/if}
			{#if !listsPublicly(host) && listing.canListPublicly}
				<StatusBlock
					icon={Globe}
					title="Not listed publicly"
					description="List the machine to let renters place sandboxes on it at your rates."
					actions={notListedAction}
				/>
			{/if}

			<DetailSection title="Listing">
				<DetailGrid label="Listing summary">
					<DetailCell label="Status">
						{#if status}
							<Badge
								size="sm"
								variant={statusBadgeVariant(status)}
								tooltip={status.description ?? undefined}
							>
								{status.label}
							</Badge>
						{/if}
					</DetailCell>
					<DetailCell label="Whole machine">
						{#if host.currentPriceCard}
							<span class="tabular-nums">
								{formatRatePer(
									host.currentPriceCard.machineHourMicroUsd,
									MACHINE_HOUR_UNIT
								)}
							</span>
						{:else}
							<span class="text-(--text-subtle)">{NO_RATES_REASON}</span>
						{/if}
					</DetailCell>
					<DetailCell
						label="Egress this month"
						value={listing.egressBytes === null
							? null
							: formatTransferBytes(listing.egressBytes)}
					/>
				</DetailGrid>
				<SettingsSection>
					<SettingsRow
						label="Availability"
						info={status?.description ?? undefined}
						disabledReason={writeReason}
					>
						{#snippet control()}
							<ChipSwitch
								aria-label="Listing state"
								size="compact"
								options={LISTING_STATE_SWITCH}
								value={listedState(host.listing.state)}
								disabled={!listing.canWrite || listing.saving}
								onChange={listing.setState}
							/>
						{/snippet}
					</SettingsRow>
					<SettingsRow
						label="Visibility"
						description="Private machines run only this organization’s sandboxes and are never billed."
						disabledReason={writeReason}
					>
						{#snippet control()}
							<ChipSwitch
								aria-label="Listing visibility"
								size="compact"
								options={LISTING_VISIBILITY_SWITCH}
								value={host.listing.visibility}
								disabled={!listing.canWrite || listing.saving}
								onChange={listing.setVisibility}
							/>
						{/snippet}
					</SettingsRow>
				</SettingsSection>
			</DetailSection>

			<DetailSection
				title="Rates"
				info="What you keep per resource. Renters pay these plus the Snapflow fee."
				action={editRatesAction}
				separated
			>
				{#if host.currentPriceCard}
					{const card = $derived(host.currentPriceCard)}
					<DetailColumn>
						{#each hostRateFields(card.gpuCount > 0) as field (field.key)}
							<DetailItem
								label={field.label}
								value={formatRatePer(card[field.key], field.unit)}
							/>
						{/each}
					</DetailColumn>
				{:else}
					<StatusBlock
						icon={Store}
						title="No rates yet"
						description="Set what you keep per vCPU, memory, GPU and disk before listing."
					/>
				{/if}
			</DetailSection>

			<DetailSection title="Rental" separated>
				<SettingsSection>
					{#if host.gpuCount > 0}
						<SettingsRow
							label="GPU sandboxes only"
							description="Rent the machine only to sandboxes that use its GPUs."
							disabledReason={writeReason}
						>
							{#snippet control(id)}
								<Switch
									{id}
									checked={host.listing.gpuOnly}
									disabled={!listing.canWrite || listing.saving}
									onCheckedChange={(gpuOnly) => listing.save({ gpuOnly })}
								/>
							{/snippet}
						</SettingsRow>
					{/if}
					<SettingsRow
						label="Interruptible sandboxes"
						description="Rent idle capacity at your interruptible share. On-demand sandboxes stop them when they need the machine."
						disabledReason={writeReason}
					>
						{#snippet control(id)}
							<Switch
								{id}
								checked={host.listing.interruptibleEnabled}
								disabled={!listing.canWrite || listing.saving}
								onCheckedChange={(interruptibleEnabled) =>
									listing.save({ interruptibleEnabled })}
							/>
						{/snippet}
					</SettingsRow>
					<SettingsRow
						label="Monthly traffic cap"
						description="After this much monthly traffic the machine takes no new sandboxes."
						layout="split"
						error={listing.trafficCapError}
						disabledReason={writeReason}
					>
						{#snippet control(id)}
							<ChipInput
								{id}
								inputmode="numeric"
								placeholder="No cap"
								disabled={!listing.canWrite}
								error={listing.trafficCapError !== null}
								aria-invalid={listing.trafficCapError !== null || undefined}
								value={listing.trafficCapText}
								oninput={(event) =>
									(listing.trafficCapDraft = event.currentTarget.value)}
								onblur={listing.commitTrafficCap}
								onkeydown={(event) => {
									if (event.key === 'Enter') listing.commitTrafficCap();
								}}
								endAdornment={capSuffix}
							/>
						{/snippet}
					</SettingsRow>
				</SettingsSection>
				{#if host.listing.trafficCapReachedAt}
					<DetailColumn>
						<DetailItem label="Cap reached">
							<span class="text-(--warning)">
								{formatDateTime(host.listing.trafficCapReachedAt)}
							</span>
						</DetailItem>
					</DetailColumn>
				{/if}
			</DetailSection>

			{#if listing.canReadPayouts}
				<DetailSection title="Earnings" action={allPayoutsAction} separated>
					<DetailColumn>
						{#if earningStatus}
							<DetailItem label="Status">
								<Badge
									size="sm"
									variant={statusBadgeVariant(earningStatus)}
									tooltip={earningStatus.description ?? undefined}
								>
									{earningStatus.label}
								</Badge>
							</DetailItem>
						{/if}
						{#if currentKey?.payoutAddress}
							<DetailItem label="Pays to">
								<AddressDisplay value={currentKey.payoutAddress} />
							</DetailItem>
						{/if}
						{#if progress !== null}
							<DetailItem label="Progress to the next payout">
								<Meter
									class="w-32"
									label="Progress to the next payout"
									value={progress}
									maximum={PERCENT_MAXIMUM}
									valueText={`${progress}%`}
									tone="default"
								/>
								<span class="tabular-nums">{progress}%</span>
							</DetailItem>
						{/if}
					</DetailColumn>
				</DetailSection>
			{/if}

			<DetailSection title="Verification" action={verificationAction} separated>
				<DetailColumn>
					<DetailItem label="Tier">
						{#if listing.verification.data}
							<span class="truncate">
								{verificationSummary(listing.verification.data)}
							</span>
						{:else if listing.verification.isError}
							<span class="text-(--text-subtle)">Unavailable</span>
						{:else}
							<Skeleton class="h-4 w-32" />
						{/if}
					</DetailItem>
				</DetailColumn>
			</DetailSection>
		{/if}
	</PageColumn>

	<ResourceDetailsPanel
		open={listing.verificationOpen && listing.verification.data !== undefined}
		title="Verification"
		onClose={() => (listing.verificationOpen = false)}
	>
		{#if listing.verification.data}
			<MachineVerificationSections
				verification={listing.verification.data}
				canRequestBenchmark={listing.canWrite}
				requesting={listing.benchmark.isPending}
				onRequestBenchmark={listing.requestBenchmark}
			/>
		{/if}
	</ResourceDetailsPanel>
</div>

<MachineRatesModal
	machine={listing.ratesOpen && host ? host : null}
	onClose={listing.closeRates}
/>
<ListPubliclyModal {listing} machineName={machine.name} />
<ChangePayoutWalletModal
	open={listing.changingWallet}
	current={listing.payout.wallet}
	onClose={() => (listing.changingWallet = false)}
/>
