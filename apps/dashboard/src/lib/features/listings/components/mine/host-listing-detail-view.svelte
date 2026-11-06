<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Cpu from '@lucide/svelte/icons/cpu';
import Gpu from '@lucide/svelte/icons/gpu';
import FeedbackState from '#lib/components/feedback-state.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipCopyInput from '#lib/components/ui/chip/chip-copy-input.svelte';
import ChipSwitch from '#lib/components/ui/chip/chip-switch.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import HostListingModals from '#lib/features/listings/components/mine/host-listing-modals.svelte';
import MachineVerificationSections from '#lib/features/listings/components/mine/machine-verification-sections.svelte';
import { hostMachineSpecs } from '#lib/features/listings/lib/host-listing.ts';
import {
	LISTING_STATE_OPTIONS,
	listingFloorLabel,
} from '#lib/features/listings/lib/host-listing-detail.ts';
import { HOST_LISTING_VISIBILITY_OPTIONS } from '#lib/features/listings/lib/host-listing-params.ts';
import { HostListingDetail } from '#lib/features/listings/state/host-listing-detail.svelte.ts';
import CredentialDetailHeading from '#lib/features/secrets/components/credential-detail-heading.svelte';
import CredentialDetailLayout from '#lib/features/secrets/components/credential-detail-layout.svelte';
import { Path } from '#lib/routing/paths.ts';
import { formatHourlyPrice } from '#lib/utils/usd.ts';
import { resolve } from '$app/paths';

let { machineId }: { machineId: string } = $props();

const detail = new HostListingDetail(() => machineId);
const machine = $derived(detail.machine);
const listingState = $derived(detail.listingState);
const visibility = $derived(detail.visibility);
</script>

<svelte:head>
	<title>{machine?.name ?? 'Listing'} · Snapflow</title>
</svelte:head>

{#if detail.machinesQuery.isPending}
	<CredentialDetailLayout back={detail.back}>
		<FeedbackState variant="inline">Loading...</FeedbackState>
	</CredentialDetailLayout>
{:else if detail.machinesQuery.isError &&
	detail.machinesQuery.data === undefined}
	<CredentialDetailLayout back={detail.back}>
		<FeedbackState
			variant="inline"
			tone="error"
			retrying={detail.machinesQuery.isFetching}
			onRetry={() => void detail.machinesQuery.refetch()}
		>
			Could not load this listing.
		</FeedbackState>
	</CredentialDetailLayout>
{:else if !machine || !listingState || !visibility}
	<CredentialDetailLayout back={detail.back}>
		<FeedbackState variant="inline">Listing not found.</FeedbackState>
	</CredentialDetailLayout>
{:else}
	{const card = $derived(machine.currentPriceCard)}
	{#snippet cardVersion()}
		{`Card v${card?.version}`}
	{/snippet}
	<CredentialDetailLayout
		back={detail.back}
		actions={detail.actions}
		dirty={detail.dirty}
		onDiscard={detail.discard}
	>
		<CredentialDetailHeading
			icon={machine.gpuCount > 0 ? Gpu : Cpu}
			title={machine.name}
			subtitle={hostMachineSpecs(machine)}
		/>
		<SettingsSection title="Machine ID">
			<ChipCopyInput value={machine.machineId} copyLabel="Copy ID" />
		</SettingsSection>
		<SettingsSection
			title="State"
			description="Listed machines take new sandboxes. Paused machines keep their running sandboxes."
		>
			<ChipSwitch
				aria-label="Listing state"
				options={LISTING_STATE_OPTIONS}
				value={listingState}
				disabled={!detail.canWrite}
				onChange={(value) => (detail.stateDraft = value)}
			/>
		</SettingsSection>
		<SettingsSection
			title="Visibility"
			description="Private machines run only this organization’s sandboxes and are never billed."
		>
			<ChipSwitch
				aria-label="Listing visibility"
				options={HOST_LISTING_VISIBILITY_OPTIONS}
				value={visibility}
				disabled={!detail.canWrite}
				onChange={(value) => (detail.visibilityDraft = value)}
			/>
		</SettingsSection>
		{#if detail.blockers.needsPrice}
			<Notice tone="warning">
				{#snippet title()}
					Publish prices first
				{/snippet}
				{#snippet description()}
					A public listing needs a price card. Set this machine’s prices, then
					list it publicly.
				{/snippet}
			</Notice>
		{:else if detail.blockers.needsPayout}
			{#snippet linkWalletAction()}
				<Chip variant="primary" href={resolve(Path.EARNINGS_PAYOUTS)}>
					Link payout wallet
				</Chip>
			{/snippet}
			<Notice
				tone="warning"
				action={detail.payout.canManage ? linkWalletAction : undefined}
			>
				{#snippet title()}
					Link a payout wallet first
				{/snippet}
				{#snippet description()}
					Public listings earn money, so they need a linked payout wallet that
					passed sanctions screening.
				{/snippet}
			</Notice>
		{/if}
		<SettingsSection title="Pricing">
			<KeyValueList>
				<KeyValueRow detail={card ? cardVersion : undefined}>
					{#snippet label()}
						Reference price
					{/snippet}
					{#snippet value()}
						{card
							? formatHourlyPrice(card.referencePriceMicroUsd)
							: 'Not priced'}
					{/snippet}
				</KeyValueRow>
				<KeyValueRow>
					{#snippet label()}
						Floor
					{/snippet}
					{#snippet value()}
						<Badge
							dot
							size="sm"
							variant={!card
								? 'gray-secondary'
								: machine.listing.belowFloorSince
									? 'primary'
									: 'green'}
						>
							{listingFloorLabel(machine)}
						</Badge>
					{/snippet}
				</KeyValueRow>
			</KeyValueList>
		</SettingsSection>
		<MachineVerificationSections machineId={machine.machineId} />
	</CredentialDetailLayout>
{/if}

<HostListingModals
	bind:pricing={detail.pricing}
	payoutReady={detail.payout.ready}
/>
