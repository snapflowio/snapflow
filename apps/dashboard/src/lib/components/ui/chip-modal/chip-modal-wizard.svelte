<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { Snippet } from 'svelte';
import type { ChipModalProps } from './chip-modal.svelte';

export interface ChipModalWizardStep {
	title: string;
}

interface ChipModalWizardProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	steps: readonly ChipModalWizardStep[];
	step?: number;
	pending?: boolean;
	nextLabel?: string;
	completeLabel?: string;
	pendingLabel?: string;
	onComplete: () => void;
	size?: ChipModalProps['size'];
	children: Snippet<[step: number]>;
}
</script>

<script lang="ts">
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModal from './chip-modal.svelte';
import ChipModalBody from './chip-modal-body.svelte';
import ChipModalFooter from './chip-modal-footer.svelte';
import ChipModalHeader from './chip-modal-header.svelte';

let {
	open = $bindable(false),
	onOpenChange,
	steps,
	step = $bindable(0),
	pending = false,
	nextLabel = 'Next',
	completeLabel = 'Done',
	pendingLabel,
	onComplete,
	size = 'lg',
	children,
}: ChipModalWizardProps = $props();

const isLast = $derived(step >= steps.length - 1);
const title = $derived(steps[step]?.title ?? '');

function back(): void {
	if (step > 0) step -= 1;
}

function advance(): void {
	if (pending) return;
	if (isLast) onComplete();
	else step += 1;
}
</script>

{#snippet backAction()}
	<Chip disabled={step === 0 || pending} onclick={back}>Back</Chip>
{/snippet}

{#snippet primaryAction()}
	<Chip
		variant="primary"
		disabled={pending}
		aria-busy={pending || undefined}
		onclick={advance}
	>
		{#if pending && pendingLabel}
			{pendingLabel}
		{:else}
			{isLast ? completeLabel : nextLabel}
		{/if}
	</Chip>
{/snippet}

<ChipModal
	bind:open
	{onOpenChange}
	{size}
	srTitle={title}
	dismissDisabled={pending}
>
	<ChipModalHeader>{title}</ChipModalHeader>
	<ChipModalBody>{@render children(step)}</ChipModalBody>
	<ChipModalFooter
		hideCancel
		primaryAdjacentAction={backAction}
		{primaryAction}
	/>
</ChipModal>
