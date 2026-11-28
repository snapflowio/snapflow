<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Money from '#lib/components/ui/money.svelte';
import type { RateExample } from '#lib/features/host-pricing/lib/rate-examples.ts';

const HOURLY_UNIT = '/h';

interface RateExamplesListProps {
	examples: readonly RateExample[];
	empty?: string;
}

let { examples, empty }: RateExamplesListProps = $props();
</script>

{#each examples as example (example.label)}
	<div
		data-settings-row=""
		class="flex items-center justify-between gap-x-6 text-sm"
	>
		<div class="flex min-w-0 flex-col gap-y-1">
			<span class="truncate text-(--text-primary)">{example.label}</span>
			<span class="truncate text-(--text-muted) text-xs">
				{example.shape}
			</span>
		</div>
		<dl class="flex shrink-0 items-center gap-x-6 tabular-nums">
			<div class="flex flex-col items-end gap-y-1 max-sm:hidden">
				<dt class="text-(--text-muted) text-xs">Renter pays</dt>
				<dd class="text-(--text-secondary)">
					<Money
						microUsd={example.customerHourMicroUsd}
						precise
						unit={HOURLY_UNIT}
					/>
				</dd>
			</div>
			<div class="flex flex-col items-end gap-y-1">
				<dt class="text-(--text-muted) text-xs">You get</dt>
				<dd class="text-(--text-primary)">
					<Money
						microUsd={example.hostHourMicroUsd}
						precise
						unit={HOURLY_UNIT}
					/>
				</dd>
			</div>
		</dl>
	</div>
{:else}
	{#if empty}
		<div data-settings-row="" class="text-(--text-muted) text-sm">{empty}</div>
	{/if}
{/each}
