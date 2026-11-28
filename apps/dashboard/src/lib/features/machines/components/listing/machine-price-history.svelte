<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { createQuery } from '@tanstack/svelte-query';
import { machinePriceCardsQueryOptions } from '#lib/api/listings.ts';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Money from '#lib/components/ui/money.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';

const HOURLY_UNIT = '/h';

interface MachinePriceHistoryProps {
	machineId: string;
}

let { machineId }: MachinePriceHistoryProps = $props();

const cardsQuery = createQuery(() => machinePriceCardsQueryOptions(machineId));
const cards = $derived(cardsQuery.data?.items ?? []);
</script>

{#if cards.length > 0}
	<SettingsSection
		title="Published rates"
		info="Whole machine per hour at each published version."
	>
		<KeyValueList>
			{#each cards as card (card.id)}
				<KeyValueRow label={`Version ${card.version}`} align="end">
					<span class="inline-flex items-baseline gap-3">
						<Timestamp value={card.createdAt} class="text-(--text-muted)" />
						<Money microUsd={card.machineHourMicroUsd} unit={HOURLY_UNIT} />
					</span>
				</KeyValueRow>
			{/each}
		</KeyValueList>
	</SettingsSection>
{/if}
