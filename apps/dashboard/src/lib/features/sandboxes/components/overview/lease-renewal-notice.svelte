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
	type SandboxLease,
	SandboxPlacementErrorCode,
	type SandboxQuote,
} from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import { showApiError } from '#lib/api/errors/show-api-error.ts';
import { listingQueryOptions } from '#lib/api/listings.ts';
import { acceptLeaseRenewalMutationOptions } from '#lib/api/sandboxes/sandboxes.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import { placementError } from '#lib/features/sandboxes/lib/placement-errors.ts';
import { formatDateTime } from '#lib/utils/format.ts';
import { formatHourlyPrice } from '#lib/utils/usd.ts';

interface LeaseRenewalNoticeProps {
	canWrite: boolean;
	lease: SandboxLease;
	sandboxId: string;
}

let { canWrite, lease, sandboxId }: LeaseRenewalNoticeProps = $props();

const current = createQuery(() =>
	listingQueryOptions(lease.machineId, {
		cpu: lease.cpu,
		memoryGiB: lease.memoryGiB,
		diskGiB: lease.diskGiB,
		gpu: lease.gpu,
	})
);
let changedQuote = $state.raw<SandboxQuote | null>(null);
const accept = createMutation(() => ({
	...acceptLeaseRenewalMutationOptions(sandboxId),
	onMutate: () => {
		changedQuote = null;
	},
	onError: (error: Error) => {
		const placement = placementError(error);
		if (placement?.kind === SandboxPlacementErrorCode.PriceChanged) {
			changedQuote = placement.quote;
		} else {
			showApiError(error, 'Failed to accept the renewal');
		}
	},
}));
const offer = $derived(changedQuote ?? current.data);
const renewalPriceCardId = $derived(canWrite ? offer?.priceCardId : undefined);
const deadline = $derived(
	lease.renewalDeadline
		? ` Accept by ${formatDateTime(lease.renewalDeadline)} or the sandbox stops.`
		: ''
);

function acceptRenewal() {
	if (renewalPriceCardId) accept.mutate(renewalPriceCardId);
}
</script>

<Notice tone="warning" action={renewalPriceCardId ? acceptAction : undefined}>
	{#snippet title()}
		{offer
			? `The machine now costs ${formatHourlyPrice(offer.hourlyPriceMicroUsd)}`
			: 'The machine’s price rose'}
	{/snippet}
	{#snippet description()}
		{`${changedQuote ? 'The price changed again; accept the new price to renew.' : 'Your locked price ended.'}${deadline} You can also move the sandbox to another machine.`}
	{/snippet}
</Notice>

{#snippet acceptAction()}
	<Chip variant="primary" disabled={accept.isPending} onclick={acceptRenewal}>
		Accept renewal
	</Chip>
{/snippet}
