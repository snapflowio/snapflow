<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import {
	type SandboxPlacementAlternative,
	SandboxPlacementErrorCode,
} from '@snapflow/api-client';
import Notice from '#lib/components/ui/notice.svelte';
import { MACHINE_UNAVAILABLE_REASON_LABELS } from '#lib/features/listings/lib/listing-format.ts';
import type { PlacementError } from '#lib/features/sandboxes/lib/placement-errors.ts';
import { formatHourlyPrice } from '#lib/utils/usd.ts';
import MachineUnavailableNotice from './machine-unavailable-notice.svelte';

interface SandboxPlacementErrorNoticeProps {
	error: PlacementError;
	onUseMachine?: (alternative: SandboxPlacementAlternative) => void;
}

let { error: placementError, onUseMachine }: SandboxPlacementErrorNoticeProps =
	$props();
</script>

{#if placementError.kind === SandboxPlacementErrorCode.PriceChanged}
	{const hourlyPrice = $derived(
		formatHourlyPrice(placementError.quote.hourlyPriceMicroUsd)
	)}
	<Notice tone="warning">
		{#snippet title()}
			The machine’s price changed to {hourlyPrice}
		{/snippet}
		{#snippet description()}
			The new quote is shown below. Confirm again to accept the new price.
		{/snippet}
	</Notice>
{:else if placementError.kind ===
	SandboxPlacementErrorCode.LeaseRenewalRequired}
	<Notice tone="warning">
		{#snippet title()}
			Lease renewal required
		{/snippet}
		{#snippet description()}
			The locked price expired and the machine’s price rose. Accept the renewed
			price on the overview or move the sandbox.
		{/snippet}
	</Notice>
{:else if placementError.kind === SandboxPlacementErrorCode.MachineUnavailable}
	<MachineUnavailableNotice
		alternatives={placementError.alternatives}
		reason={MACHINE_UNAVAILABLE_REASON_LABELS[placementError.reason]}
		{onUseMachine}
	/>
{/if}
