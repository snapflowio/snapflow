<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const OWN_MACHINE_INFO =
	'This machine belongs to your organization, so sandboxes run on it for free.';
const RUNNING_INFO = 'For the requested shape';
const STOPPED_INFO = 'Disk kept on the machine';
const FREE_LABEL = 'Free';
</script>

<script lang="ts">
import DetailCell from '#lib/components/detail/detail-cell.svelte';
import DetailGrid from '#lib/components/detail/detail-grid.svelte';
import DetailSection from '#lib/components/detail/detail-section.svelte';
import PageColumn from '#lib/components/page/page-column.svelte';
import Money from '#lib/components/ui/money.svelte';
import {
	formatCpu,
	formatGpu,
} from '#lib/features/listings/lib/listing-format.ts';
import { getListingDetail } from '#lib/features/listings/state/listing-detail.svelte.ts';
import { formatDateTime } from '#lib/utils/format.ts';
import { platformFeeLabel } from '#lib/utils/usd.ts';

const detail = getListingDetail();
const listing = $derived(detail.loaded);
const free = $derived(listing.priceCardId === null);
const specs = $derived([
	{ label: 'CPU', value: formatCpu(listing.vcpu, listing.cpuModel) },
	{ label: 'Memory', value: `${listing.memoryGiB} GiB` },
	{ label: 'Disk', value: `${listing.diskGiB} GiB` },
	{ label: 'GPU', value: formatGpu(listing) },
]);
</script>

<PageColumn class="gap-y-12">
	<DetailSection
		title="Specs"
		info={`Measured by the platform benchmark on ${formatDateTime(listing.measuredAt)}.`}
		separated={false}
	>
		<DetailGrid label="Specs">
			{#each specs as spec (spec.label)}
				<DetailCell label={spec.label} value={spec.value} />
			{/each}
		</DetailGrid>
	</DetailSection>
	<DetailSection
		title="Pricing"
		info={free
			? OWN_MACHINE_INFO
			: `${platformFeeLabel(listing.markupBasisPoints)}. Billed per second of use; traffic is included.`}
	>
		<DetailGrid label="Pricing">
			{#if free}
				<DetailCell label="Running" info={RUNNING_INFO} value={FREE_LABEL} />
				<DetailCell label="Stopped" info={STOPPED_INFO} value={FREE_LABEL} />
			{:else}
				<DetailCell label="Running" info={RUNNING_INFO}>
					<Money microUsd={listing.hourlyPriceMicroUsd} unit="/h" />
				</DetailCell>
				<DetailCell label="Stopped" info={STOPPED_INFO}>
					<Money microUsd={listing.stoppedHourlyPriceMicroUsd} unit="/h" />
				</DetailCell>
				<DetailCell
					label="Whole machine"
					info="Rented only while nothing else runs on it"
				>
					<Money microUsd={listing.wholeMachineHourlyPriceMicroUsd} unit="/h" />
				</DetailCell>
				<DetailCell label="Platform fee">
					<Money microUsd={listing.markupHourlyMicroUsd} unit="/h" />
				</DetailCell>
				{#if listing.gpuCount > 0 && listing.gpuOnly}
					<DetailCell
						label="GPU sandboxes"
						info="The host rents this machine only to GPU sandboxes"
						value="Only"
					/>
				{/if}
			{/if}
		</DetailGrid>
	</DetailSection>
</PageColumn>
