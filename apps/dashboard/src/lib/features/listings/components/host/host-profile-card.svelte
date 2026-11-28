<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { formatBasisPointsPercent } from '#lib/utils/format.ts';

const NOT_ASSESSED = 'Not assessed';
const NONE_YET = 'None yet';

function basisPoints(value: number | null): string {
	return value === null ? NOT_ASSESSED : formatBasisPointsPercent(value);
}
</script>

<script lang="ts">
import type { HostStats } from '@snapflow/api-client';
import StatisticCard from '#lib/components/detail/statistic-card.svelte';
import IdentityTile from '#lib/components/ui/avatar/identity-tile.svelte';
import { MACHINE_TIER_LABELS } from '#lib/features/listings/lib/listing-format.ts';
import { formatCount } from '#lib/utils/format.ts';

interface HostProfileCardProps {
	displayName: string;
	description: string | null;
	stats: HostStats | undefined;
}

let { displayName, description, stats }: HostProfileCardProps = $props();
</script>

<div class="flex flex-col gap-6">
	<div class="flex min-w-0 items-center gap-4">
		<IdentityTile name={displayName} size="lg" class="size-12" />
		<div class="flex min-w-0 flex-col gap-0.5">
			<p class="truncate text-(--text-primary) text-base">{displayName}</p>
			{#if description}
				<p class="line-clamp-2 text-(--text-muted) text-sm">{description}</p>
			{/if}
		</div>
	</div>
	{#if stats}
		<div class="grid grid-cols-2 gap-x-6 gap-y-4">
			<StatisticCard
				label="Listed machines"
				value={formatCount(stats.listedMachines)}
			/>
			<StatisticCard
				label="Reliability"
				value={basisPoints(stats.reliabilityBasisPoints)}
			/>
			<StatisticCard
				label="Uptime"
				value={basisPoints(stats.uptimeBasisPoints)}
			/>
			<StatisticCard
				label="Top tier"
				value={stats.topTier ? MACHINE_TIER_LABELS[stats.topTier] : NONE_YET}
			/>
		</div>
	{/if}
</div>
