<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { EMPTY_CELL_PLACEHOLDER } from '#lib/components/resource/table/resource-table.ts';
import Money, { type MoneyUnit } from '#lib/components/ui/money.svelte';

interface MachineMoneyCellProps {
	microUsd: string | null | undefined;
	unit?: MoneyUnit;
	muted?: boolean;
}

let { microUsd, unit, muted = false }: MachineMoneyCellProps = $props();
</script>

{#if microUsd}
	<span class={['tabular-nums', muted && 'text-(--text-muted)']}>
		<Money {microUsd} {unit} />
	</span>
{:else}
	<span class="text-(--text-muted)">{EMPTY_CELL_PLACEHOLDER}</span>
{/if}
