<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { MarketReferencePrice } from '@snapflow/api-client';

const INVALID_MEDIAN_MESSAGE =
	'Enter a positive USD amount with at most six decimal places.';

interface ReferencePriceModalProps {
	price: MarketReferencePrice | null;
	pending: boolean;
	onSave: (priceClass: string, bootstrapMedianMicroUsd: string) => void;
	onClose: () => void;
}
</script>

<script lang="ts">
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipInputPrefix from '#lib/components/ui/chip/chip-input-prefix.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import { formatMicroUsdAmount, usdInputToMicroUsd } from '#lib/utils/usd.ts';

let { price, pending, onSave, onClose }: ReferencePriceModalProps = $props();

const medianId = $props.id();
let median = $derived(
	price?.bootstrapMedianMicroUsd
		? formatMicroUsdAmount(price.bootstrapMedianMicroUsd)
		: ''
);
const medianMicroUsd = $derived(usdInputToMicroUsd(median));
const invalid = $derived(Boolean(median.trim()) && !medianMicroUsd);

function submit() {
	if (price && !pending && medianMicroUsd) {
		onSave(price.priceClass, medianMicroUsd);
	}
}

function setOpen(open: boolean) {
	if (!open) onClose();
}
</script>

{#snippet usdPrefix()}
	<ChipInputPrefix>$</ChipInputPrefix>
{/snippet}

<ChipModal
	bind:open={() => price !== null, setOpen}
	onsubmit={submit}
	srTitle="Set bootstrap median"
	dismissDisabled={pending}
>
	<ChipModalHeader {onClose} closeDisabled={pending}>
		Set bootstrap median
	</ChipModalHeader>
	<ChipModalBody>
		<ChipModalField
			label={price ? `${price.priceClass} median per hour` : 'Median per hour'}
			for={medianId}
			required
			hint="Host price of the class reference shape for one hour. Sets the floor until enough Verified hosts publish prices."
			error={invalid ? INVALID_MEDIAN_MESSAGE : null}
		>
			<ChipInput
				id={medianId}
				inputmode="decimal"
				startAdornment={usdPrefix}
				error={invalid}
				bind:value={median}
			/>
		</ChipModalField>
	</ChipModalBody>
	<ChipModalFooter onCancel={onClose} cancelDisabled={pending}>
		{#snippet primaryAction()}
			<ChipModalAction
				type="submit"
				variant="primary"
				disabled={pending || !medianMicroUsd}
			>
				{pending ? 'Saving...' : 'Save'}
			</ChipModalAction>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
