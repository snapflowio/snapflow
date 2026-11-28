<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { Snippet } from 'svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import ChipModalReviewSection from '#lib/components/ui/chip-modal/chip-modal-review-section.svelte';
import { formatUsd } from '#lib/utils/usd.ts';

interface WalletFeeReviewProps {
	feeMicroUsd: bigint;
	children?: Snippet;
}

let { feeMicroUsd, children }: WalletFeeReviewProps = $props();
</script>

<ChipModalReviewSection title="Transaction">
	{@render children?.()}
	<KeyValueRow
		align="end"
		label="Network fee"
		value={formatUsd(feeMicroUsd.toString())}
	/>
</ChipModalReviewSection>
<p class="text-(--text-muted) text-sm">
	The fee is paid in USDC from your wallet, only if the transaction succeeds.
	Your passkey approves it next.
</p>
