<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { StatusRingShape } from '#lib/components/ui/status/status-ring.svelte';
import { DepositProgress } from '#lib/features/billing/state/escrow-deposit.svelte.ts';

const PROGRESS_ORDER = [
	DepositProgress.Signing,
	DepositProgress.Sent,
	DepositProgress.Confirming,
	DepositProgress.Added,
] as const satisfies readonly DepositProgress[];

type StepState = 'done' | 'current' | 'future';

const STEP_SHAPES = {
	done: 'check',
	current: 'half',
	future: 'dashed',
} as const satisfies Record<StepState, StatusRingShape>;
</script>

<script lang="ts">
import AddressDisplay from '#lib/components/ui/address/address-display.svelte';
import StatusRing from '#lib/components/ui/status/status-ring.svelte';
import { cn } from '#lib/utils/utils.ts';

interface DepositProgressProps {
	progress: DepositProgress;
	signerLabel: string;
	networkName: string;
	transactionHash: string | null;
}

let {
	progress,
	signerLabel,
	networkName,
	transactionHash,
}: DepositProgressProps = $props();

const reached = $derived(PROGRESS_ORDER.indexOf(progress));
const steps = $derived([
	{ id: DepositProgress.Signing, title: `Signed in ${signerLabel}` },
	{ id: DepositProgress.Sent, title: 'Sent' },
	{
		id: DepositProgress.Confirming,
		title: `Confirming on ${networkName}`,
		caption: 'usually a few minutes',
	},
	{ id: DepositProgress.Added, title: 'Added to your balance' },
]);

function stateOf(index: number): StepState {
	if (progress === DepositProgress.Added) return 'done';
	if (index < reached) return 'done';
	return index === reached ? 'current' : 'future';
}
</script>

<ol aria-label="Deposit progress" class="flex flex-col gap-0.5 px-2 py-1">
	{#each steps as step, index (step.id)}
		{const stepState = $derived(stateOf(index))}
		<li
			aria-current={stepState === 'current' ? 'step' : undefined}
			class="flex min-h-8 items-center gap-2.5"
		>
			<StatusRing
				shape={STEP_SHAPES[stepState]}
				tone={stepState === 'done' ? 'success' : 'neutral'}
				live={stepState === 'current'}
			/>
			<span
				class={cn(
					'text-sm',
					stepState === 'future'
						? 'text-(--text-muted)'
						: 'text-(--text-primary)'
				)}
			>
				{step.title}
			</span>
			{#if step.id === DepositProgress.Sent && transactionHash}
				<AddressDisplay value={transactionHash} kind="tx" />
			{/if}
			{#if step.caption && stepState === 'current'}
				<span class="text-(--text-muted) text-xs">{step.caption}</span>
			{/if}
		</li>
	{/each}
</ol>
