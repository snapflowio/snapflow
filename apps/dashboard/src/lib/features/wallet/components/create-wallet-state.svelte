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
import Wallet from '@lucide/svelte/icons/wallet';
import StatusBlock from '#lib/components/detail/status-block.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import { supportsPasskeys } from '#lib/features/auth/lib/sign-in/passkey-support.ts';
import type { UserWalletState } from '#lib/features/wallet/state/user-wallet.svelte.ts';

interface CreateWalletStateProps {
	wallet: UserWalletState;
}

let { wallet }: CreateWalletStateProps = $props();

const passkeysSupported = supportsPasskeys();
</script>

<StatusBlock
	icon={Wallet}
	tone="neutral"
	title="Create your wallet"
	description="A self-custodial USDC wallet owned by your passkey."
	class="py-12"
>
	{#snippet actions()}
		<Chip
			variant="primary"
			rightIcon={ArrowRight}
			disabled={!passkeysSupported || !wallet.passkeysLoaded || wallet.creating}
			disabledReason={passkeysSupported
				? null
				: 'Passkeys are not supported by this browser'}
			onclick={wallet.createWallet}
		>
			{wallet.creating ? 'Waiting for passkey...' : 'Create wallet'}
		</Chip>
	{/snippet}
</StatusBlock>
