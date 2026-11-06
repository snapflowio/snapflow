<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Ellipsis from '@lucide/svelte/icons/ellipsis';
import Link from '@lucide/svelte/icons/link';
import WalletIcon from '@lucide/svelte/icons/wallet';
import type { PaymentWallet, PaymentWalletPurpose } from '@snapflow/api-client';
import { createMutation } from '@tanstack/svelte-query';
import type { Snippet } from 'svelte';
import {
	linkPaymentWalletMutationOptions,
	unlinkPaymentWalletMutationOptions,
} from '#lib/api/settlement/wallets.ts';
import Trash from '#lib/components/icons/trash.svelte';
import SettingsResourceRow from '#lib/components/settings/settings-resource-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Chip, { chipVariants } from '#lib/components/ui/chip/chip.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import DropdownMenu from '#lib/components/ui/dropdown-menu/dropdown-menu.svelte';
import DropdownMenuContent from '#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
import DropdownMenuItem from '#lib/components/ui/dropdown-menu/dropdown-menu-item.svelte';
import { MENU_LABEL_CLASS } from '#lib/components/ui/dropdown-menu/dropdown-menu-styles.ts';
import DropdownMenuTrigger from '#lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
import {
	SANCTIONS_BADGES,
	shortAddress,
	WALLET_PURPOSES,
} from '#lib/features/billing/lib/payment-wallet.ts';
import type { WalletConnection } from '#lib/features/billing/state/wallet.svelte.ts';
import { formatDate } from '#lib/utils/format.ts';
import { titleCase } from '#lib/utils/text.ts';

interface PaymentWalletSectionProps {
	purpose: PaymentWalletPurpose;
	linked: PaymentWallet | undefined;
	connection: WalletConnection;
	canManage: boolean;
	description: string;
	accessory?: Snippet;
}

let {
	purpose,
	linked,
	connection,
	canManage,
	description,
	accessory,
}: PaymentWalletSectionProps = $props();

const copy = $derived(WALLET_PURPOSES[purpose]);
const label = $derived(copy.label);
const link = createMutation(() =>
	linkPaymentWalletMutationOptions(connection.signMessage)
);
const unlink = createMutation(() => unlinkPaymentWalletMutationOptions());
let confirmingUnlink = $state(false);
const connectedIsLinked = $derived(connection.controls(linked?.address));
const canLink = $derived(
	canManage && connection.escrow !== null && !connectedIsLinked
);
const connectedDescription = $derived(
	!connection.connected
		? 'Connect a wallet to link it, fund the escrow or sign.'
		: connection.onSettlementChain
			? connectedIsLinked
				? `Connected on ${connection.networkName} · this is your ${label}`
				: `Connected on ${connection.networkName}`
			: `Connected to another network · switch to ${connection.networkName}`
);

function linkConnected(): void {
	const address = connection.address;
	if (address) link.mutate({ purpose, address });
}

function confirmUnlink(event: SubmitEvent): void {
	event.preventDefault();
	unlink.mutate(purpose, {
		onSuccess: () => {
			confirmingUnlink = false;
		},
	});
}
</script>

{#snippet linkedBadge()}
	{#if linked}
		{const badge = $derived(SANCTIONS_BADGES[linked.sanctionsStatus])}
		<Badge size="sm" variant={badge.variant}>{badge.label}</Badge>
	{/if}
{/snippet}

{#snippet linkedMenu()}
	<DropdownMenu>
		<DropdownMenuTrigger>
			{#snippet child({
				props,
			})}
				<button
					{...props}
					type="button"
					aria-label={`${titleCase(label)} actions`}
					class={chipVariants()}
				>
					<Ellipsis class="size-3.5 shrink-0 text-(--text-icon)" />
				</button>
			{/snippet}
		</DropdownMenuTrigger>
		<DropdownMenuContent align="end">
			<DropdownMenuItem
				destructive
				onSelect={() => {
					confirmingUnlink = true;
				}}
			>
				<Trash />
				<span class={MENU_LABEL_CLASS}>Unlink</span>
			</DropdownMenuItem>
		</DropdownMenuContent>
	</DropdownMenu>
{/snippet}

{#snippet connectedActions()}
	{#if !connection.connected}
		<Chip
			variant="primary"
			disabled={connection.connecting}
			onclick={connection.connect}
		>
			{connection.connecting ? 'Connecting...' : 'Connect wallet'}
		</Chip>
	{:else}
		{#if !connection.onSettlementChain}
			<Chip variant="primary" onclick={connection.switchNetwork}>
				{`Switch to ${connection.networkName}`}
			</Chip>
		{:else if canLink}
			<Chip
				variant="primary"
				leftIcon={Link}
				disabled={link.isPending}
				onclick={linkConnected}
			>
				{link.isPending
					? 'Waiting for signature...'
					: linked
						? 'Replace linked wallet'
						: `Link as ${label}`}
			</Chip>
		{/if}
		<Chip onclick={connection.manage}>Manage</Chip>
	{/if}
{/snippet}

<SettingsSection title={titleCase(label)} {description} {accessory}>
	<div class="flex flex-col gap-y-0.5">
		<SettingsResourceRow
			icon={WalletIcon}
			title={linked ? shortAddress(linked.address) : `No ${label} linked`}
			description={linked
				? `Linked ${formatDate(linked.verifiedAt)} · ${linked.address}`
				: canManage
					? 'Connect a wallet below and sign a message to prove you control it.'
					: `Ask a member who manages ${copy.managedBy} to link one.`}
			badge={linked ? linkedBadge : undefined}
			trailing={linked && canManage ? linkedMenu : undefined}
		/>
		<SettingsResourceRow
			icon={Link}
			title={connection.address
				? shortAddress(connection.address)
				: 'No wallet connected'}
			description={connectedDescription}
			trailing={connectedActions}
		/>
	</div>
</SettingsSection>
<ChipModalConfirm
	bind:open={confirmingUnlink}
	title={`Unlink ${label}`}
	text={linked
		? [
				{ text: shortAddress(linked.address), bold: true },
				` stops being your ${label}. `,
				{
					text: copy.unlinkWarning,
					error: true,
				},
			]
		: ''}
	pending={unlink.isPending}
	onsubmit={confirmUnlink}
>
	{#snippet confirm()}
		<ChipModalAction
			type="submit"
			variant="destructive"
			disabled={unlink.isPending}
		>
			{unlink.isPending ? 'Unlinking...' : 'Unlink'}
		</ChipModalAction>
	{/snippet}
</ChipModalConfirm>
