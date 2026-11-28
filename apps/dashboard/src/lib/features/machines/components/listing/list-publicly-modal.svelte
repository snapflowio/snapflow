<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Globe from '@lucide/svelte/icons/globe';
import { getWebsiteLinks } from '#lib/api/public-config.ts';
import LabeledCheckbox from '#lib/components/ui/checkbox/labeled-checkbox.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import PriceSplitRows from '#lib/features/host-pricing/components/price-split-rows.svelte';
import type { MachineListingState } from '#lib/features/machines/state/machine-listing.svelte.ts';

interface ListPubliclyModalProps {
	listing: MachineListingState;
	machineName: string;
}

let { listing, machineName }: ListPubliclyModalProps = $props();

const { hostTermsHref } = getWebsiteLinks();

function submit(event: SubmitEvent): void {
	event.preventDefault();
	void listing.confirmPublish();
}
</script>

<ChipModalConfirm
	bind:open={listing.publishing}
	icon={Globe}
	title="List publicly?"
	text={`Renters can place sandboxes on ${machineName} at these rates.`}
	pending={listing.publishPending}
	error={listing.publishError}
	size="md"
	onsubmit={submit}
>
	<div class="flex flex-col gap-3">
		{#if listing.split && listing.markupBasisPoints !== null}
			<PriceSplitRows
				split={listing.split}
				markupBasisPoints={listing.markupBasisPoints}
				label="Whole machine"
			/>
		{/if}
		{#if listing.needsTerms}
			<LabeledCheckbox bind:checked={listing.termsChecked}>
				I accept the
				<a
					class="underline underline-offset-4 hover-hover:text-(--text-primary)"
					href={hostTermsHref}
					target="_blank"
					rel="noopener noreferrer"
					>host terms</a
				>
			</LabeledCheckbox>
		{/if}
	</div>
	{#snippet confirm()}
		<Chip
			type="submit"
			variant="primary"
			loading={listing.publishPending}
			disabledReason={listing.publishReady
				? undefined
				: 'Accept the host terms first'}
		>
			List publicly
		</Chip>
	{/snippet}
</ChipModalConfirm>
