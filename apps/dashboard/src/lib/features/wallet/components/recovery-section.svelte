<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import Check from '@lucide/svelte/icons/check';
import LoaderCircle from '@lucide/svelte/icons/loader-circle';
import ShieldAlert from '@lucide/svelte/icons/shield-alert';
import { RecoveryStatus } from '@snapflow/api-client';
import type { StatusBlockTone } from '#lib/components/detail/status-block.svelte';
import type { IconComponent } from '#lib/components/icons/icon-component.ts';

interface RecoveryStatusCopy {
	title: string;
	icon: IconComponent;
	tone: StatusBlockTone;
	description: string;
}

const RECOVERY_STATUS = {
	[RecoveryStatus.None]: {
		title: 'Recovery is not set up',
		icon: ShieldAlert,
		tone: 'warning',
		description:
			'Until recovery is set up, USDC cannot leave the wallet and its passkey cannot be removed.',
	},
	[RecoveryStatus.Pending]: {
		title: 'Setting up recovery',
		icon: LoaderCircle,
		tone: 'neutral',
		description: 'The recovery owner is being added on chain.',
	},
	[RecoveryStatus.Active]: {
		title: 'Recovery is set up',
		icon: Check,
		tone: 'success',
		description: 'The wallet can be recovered without your passkey.',
	},
} as const satisfies Record<RecoveryStatus, RecoveryStatusCopy>;

const STATUS_ICON_CLASS = {
	success: 'text-(--success)',
	warning: 'text-(--warning)',
	error: 'text-(--destructive)',
	neutral: 'animate-spin text-(--text-muted) motion-reduce:animate-none',
} as const satisfies Record<StatusBlockTone, string>;

const RECOVERY_DESCRIPTION =
	'A second owner that can recover the wallet if you lose your passkey.';
const RECOVERY_INFO =
	'Either owner alone controls the wallet. Snapflow is never an owner.';
</script>

<script lang="ts">
import ArrowRight from '@lucide/svelte/icons/arrow-right';
import type { UserWallet } from '@snapflow/api-client';
import PageSection from '#lib/components/detail/page-section.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import { RECOVERY_KINDS } from '#lib/features/wallet/lib/wallet-status.ts';
import type { UserWalletState } from '#lib/features/wallet/state/user-wallet.svelte.ts';
import { cn } from '#lib/utils/utils.ts';

interface RecoverySectionProps {
	wallet: UserWalletState;
	account: UserWallet;
	primary?: boolean;
	onSetUp: () => void;
}

let {
	wallet,
	account,
	primary = false,
	onSetUp,
}: RecoverySectionProps = $props();

const status = $derived(RECOVERY_STATUS[account.recoveryStatus]);
const canSetUp = $derived(
	account.recoveryStatus === RecoveryStatus.None && wallet.signing !== null
);
const owner = $derived(
	account.recoveryOwnerKind
		? RECOVERY_KINDS[account.recoveryOwnerKind].label
		: null
);
</script>

<PageSection
	title="Recovery owner"
	description={RECOVERY_DESCRIPTION}
	info={RECOVERY_INFO}
>
	{#if account.recoveryStatus === RecoveryStatus.None}
		<Notice tone="warning" title={status.title} info={status.description}>
			{#snippet action()}
				{#if canSetUp}
					<Chip
						variant={primary ? 'primary' : 'secondary'}
						rightIcon={ArrowRight}
						onclick={onSetUp}
					>
						Set up recovery
					</Chip>
				{/if}
			{/snippet}
		</Notice>
	{:else}
		<KeyValueList label="Recovery details">
			<KeyValueRow label="Status" info={status.description}>
				<span class="inline-flex items-center gap-2">
					<status.icon class={cn('size-4', STATUS_ICON_CLASS[status.tone])} />
					{status.title}
				</span>
			</KeyValueRow>
			<KeyValueRow label="Recovery owner" value={owner} />
		</KeyValueList>
	{/if}
</PageSection>
