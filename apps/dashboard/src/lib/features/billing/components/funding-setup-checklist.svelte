<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Wallet from '@lucide/svelte/icons/wallet';
import Chip from '#lib/components/ui/chip/chip.svelte';
import type { StatusRingShape } from '#lib/components/ui/status/status-ring.svelte';
import StatusRing from '#lib/components/ui/status/status-ring.svelte';
import {
	currentSetupStep,
	type FundingSetupStep,
} from '#lib/features/billing/lib/funding-setup.ts';
import type { FundingDialog } from '#lib/routing/funding-dialog.ts';
import { cn } from '#lib/utils/utils.ts';
import AskBillingManager from './ask-billing-manager.svelte';

interface FundingSetupChecklistProps {
	steps: readonly FundingSetupStep[];
	canManage: boolean;
	onAction: (dialog: FundingDialog) => void;
}

let { steps, canManage, onAction }: FundingSetupChecklistProps = $props();

const titleId = $props.id();
const current = $derived(currentSetupStep(steps));
const position = $derived(current ? steps.indexOf(current) + 1 : steps.length);

function shapeOf(step: FundingSetupStep): StatusRingShape {
	if (step.done) return 'check';
	return step === current ? 'half' : 'dashed';
}
</script>

<section
	aria-labelledby={titleId}
	class="grid overflow-hidden rounded-2xl border border-border bg-bg lg:grid-cols-2"
>
	<div class="flex flex-col gap-y-4 p-6">
		<div class="flex items-center gap-x-3">
			<span
				aria-hidden="true"
				class="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-5 text-(--text-primary)"
			>
				<Wallet class="size-4" />
			</span>
			<h2 id={titleId} class="text-(--text-primary) text-sm font-medium">
				Finish setting up billing
			</h2>
		</div>
		<p class="text-(--text-muted) text-sm">
			{`Step ${position} of ${steps.length}. Sandboxes start once a funded wallet pays hosts automatically.`}
		</p>
		<div class="mt-auto flex flex-wrap items-center gap-2">
			{#if current}
				{#if canManage}
					<Chip variant="primary" onclick={() => onAction(current.dialog)}>
						{current.action}
					</Chip>
				{:else}
					<AskBillingManager />
				{/if}
			{/if}
		</div>
	</div>
	<ol class="flex flex-col border-border border-t lg:border-t-0 lg:border-l">
		{#each steps as step (step.title)}
			{const active = $derived(step === current)}
			<li
				aria-current={active ? 'step' : undefined}
				class={cn(
					'flex min-h-14 items-center gap-3 border-border border-b px-6 py-3 last:border-b-0',
					active && 'bg-surface-3'
				)}
			>
				<StatusRing
					shape={shapeOf(step)}
					tone={step.done ? 'success' : 'neutral'}
				/>
				<span
					class={cn(
						'min-w-0 flex-1 truncate text-sm',
						active ? 'text-(--text-primary)' : 'text-(--text-muted)',
						step.done && 'line-through decoration-(--text-subtle)'
					)}
				>
					{step.title}
				</span>
			</li>
		{/each}
	</ol>
</section>
