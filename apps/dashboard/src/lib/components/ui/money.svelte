<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { ClassValue } from 'svelte/elements';

export type MoneySize = 'inline' | 'heading-s' | 'heading-l';
export type MoneyUnit = 'USDC' | '/h' | '/mo';

export interface MoneyProps {
	microUsd: bigint | string;
	size?: MoneySize;
	signed?: boolean;
	unit?: MoneyUnit;
	struck?: boolean;
	precise?: boolean;
	class?: ClassValue;
}

const SIZE_CLASS: Record<MoneySize, string> = {
	inline: '',
	'heading-s': 'heading-s',
	'heading-l': 'heading-l',
};
const MINUS_SIGN = '−';
const PLUS_SIGN = '+';
const CURRENCY_SYMBOL = '$';
const RATE_UNITS: ReadonlySet<MoneyUnit> = new Set(['/h', '/mo']);
</script>

<script lang="ts">
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';
import {
	formatMicroUsd,
	isSubCent,
	microUsdParts,
	roundedToCents,
} from '#lib/utils/usd.ts';
import { cn } from '#lib/utils/utils.ts';

let {
	microUsd,
	size = 'inline',
	signed = false,
	unit,
	struck = false,
	precise,
	class: className,
}: MoneyProps = $props();

const amount = $derived(
	typeof microUsd === 'bigint' ? microUsd : BigInt(microUsd)
);
const exact = $derived(precise ?? (unit !== undefined && RATE_UNITS.has(unit)));
const subCent = $derived(isSubCent(amount));
const shown = $derived(exact || !subCent ? amount : roundedToCents(amount));
const parts = $derived(microUsdParts(shown));
const sign = $derived.by(() => {
	if (parts.negative) return MINUS_SIGN;
	return signed && amount > 0n ? PLUS_SIGN : '';
});
const showsUnit = $derived(unit !== undefined && size !== 'inline');
const preciseText = $derived(formatMicroUsd(amount.toString()));
</script>

{#snippet figure(extra: Record<string, unknown>)}
	<span
		{...extra}
		class={cn(
			'whitespace-nowrap tabular-nums',
			SIZE_CLASS[size],
			struck && 'line-through decoration-(--text-muted)',
			className
		)}
	>
		{sign}{CURRENCY_SYMBOL}{parts.whole}<span>.{parts.fraction}</span>
		{#if unit && !showsUnit}
			<span class="text-(--text-muted)"
				>{unit === 'USDC' ? ` ${unit}` : unit}</span
			>
		{/if}
		{#if showsUnit}
			<span class="ml-1.5 align-baseline text-(--text-muted) text-[0.5em]"
				>{unit}</span
			>
		{/if}
	</span>
{/snippet}

{#if subCent && !exact}
	<Tooltip content={preciseText}>
		{#snippet child({ props })}
			{@render figure({ ...props, tabindex: 0 })}
		{/snippet}
	</Tooltip>
{:else}
	{@render figure({})}
{/if}
