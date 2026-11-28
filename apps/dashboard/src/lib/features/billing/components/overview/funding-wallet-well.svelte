<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { BadgeProps } from '#lib/components/ui/badge.svelte';
import type { StatusDotTone } from '#lib/components/ui/status/status-dot.svelte';

const READY_LABEL = 'Ready';
const SETUP_REQUIRED_LABEL = 'Setup required';
const EMPTY_VALUE = '—';
const WALLET_INFO =
	'The wallet that funds the escrow and sets the hourly limit for automatic payments. Only it can withdraw what it deposits.';

function dotTone(variant: BadgeProps['variant']): StatusDotTone {
	switch (variant) {
		case 'success':
			return 'success';
		case 'warning':
			return 'warning';
		case 'error':
			return 'error';
		default:
			return 'neutral';
	}
}
</script>

<script lang="ts">
import ExternalLink from '@lucide/svelte/icons/external-link';
import { SanctionsStatus } from '@snapflow/api-client';
import { getPublicConfig } from '#lib/api/public-config.ts';
import Well from '#lib/components/detail/well.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import StatusDot from '#lib/components/ui/status/status-dot.svelte';
import {
	WalletTab,
	walletTabHref,
} from '#lib/features/billing/lib/billing-wallet.ts';
import { WELL_FOOTER_LINK_CLASS } from '#lib/features/billing/lib/well-footer-link.ts';
import type { BillingFunding } from '#lib/features/billing/state/billing-funding.svelte.ts';
import {
	explorerAddressUrl,
	explorerName,
	openExplorer,
} from '#lib/features/wallet/lib/explorer.ts';
import {
	ESCROW_FROZEN_BADGE,
	SANCTIONS_BADGES,
	sameAddress,
	shortAddress,
} from '#lib/features/wallet/lib/payment-wallet.ts';
import { settlementChain } from '#lib/integrations/wallet/wallet-networks.ts';

interface FundingWalletWellProps {
	funding: BillingFunding;
	onManage: () => void;
}

let { funding, onManage }: FundingWalletWellProps = $props();

const { chainId } = getPublicConfig().settlement;
const networkName = settlementChain(chainId).name;
const linked = $derived(funding.fundingWallet);
const owner = $derived.by(() => {
	if (!linked) return null;
	if (sameAddress(funding.wallet.address, linked.address))
		return 'Snapflow wallet';
	return funding.connected.controls(linked.address) ? 'Connected wallet' : null;
});
const status = $derived.by((): { label: string; tone: StatusDotTone } => {
	if (!linked) return { label: SETUP_REQUIRED_LABEL, tone: 'warning' };
	if (funding.account.data?.blockedAt) {
		return {
			label: ESCROW_FROZEN_BADGE.label,
			tone: dotTone(ESCROW_FROZEN_BADGE.variant),
		};
	}
	if (linked.sanctionsStatus !== SanctionsStatus.Clear) {
		const badge = SANCTIONS_BADGES[linked.sanctionsStatus];
		return { label: badge.label, tone: dotTone(badge.variant) };
	}
	return { label: READY_LABEL, tone: 'success' };
});
const explorerHref = $derived(
	linked ? explorerAddressUrl(chainId, linked.address) : null
);
</script>

<Well
	title="Funding wallet"
	info={WALLET_INFO}
	loading={!funding.wallets.isSuccess}
>
	{#snippet actions()}
		{#if funding.canManage && funding.wallets.isSuccess}
			<Chip variant="secondary" onclick={onManage}>
				{linked ? 'Manage' : 'Link'}
			</Chip>
		{/if}
	{/snippet}
	{#if linked}
		<a
			href={walletTabHref(WalletTab.Funding)}
			class="heading-s w-fit truncate font-mono outline-none hover-hover:underline focus-visible:focus-ring"
		>
			{shortAddress(linked.address)}
		</a>
	{:else}
		<p class="heading-s text-(--text-disabled)">{EMPTY_VALUE}</p>
	{/if}
	{#snippet footer()}
		<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
			<span>{owner ? `${networkName} · ${owner}` : networkName}</span>
			<StatusDot label={status.label} tone={status.tone} />
		</div>
		{#if explorerHref}
			<Chip
				variant="ghost"
				size="compact"
				leftIcon={ExternalLink}
				class={WELL_FOOTER_LINK_CLASS}
				onclick={() => openExplorer(explorerHref)}
			>
				{`View on ${explorerName(chainId)}`}
			</Chip>
		{/if}
	{/snippet}
</Well>
