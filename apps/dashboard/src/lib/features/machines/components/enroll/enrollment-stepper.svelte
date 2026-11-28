<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { EnrollmentStepStatus } from '#lib/features/machines/lib/enrollment-progress.ts';
import { ENROLLMENT_STEP_RINGS } from './enrollment-progress-section.svelte';

type StepRing = (typeof ENROLLMENT_STEP_RINGS)[EnrollmentStepStatus];

const DONE = ENROLLMENT_STEP_RINGS[EnrollmentStepStatus.Done];
const ACTIVE = ENROLLMENT_STEP_RINGS[EnrollmentStepStatus.Current];
const WAITING = ENROLLMENT_STEP_RINGS[EnrollmentStepStatus.Waiting];
const FAILED = ENROLLMENT_STEP_RINGS[EnrollmentStepStatus.Failed];
</script>

<script lang="ts">
import PlugZap from '@lucide/svelte/icons/plug-zap';
import Terminal from '@lucide/svelte/icons/terminal';
import type { Snippet } from 'svelte';
import BrandMark from '#lib/components/brand-mark.svelte';
import StatusBlock from '#lib/components/detail/status-block.svelte';
import { PAGE_TITLE_CLASS } from '#lib/components/page/page-layout.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipCopyInput from '#lib/components/ui/chip/chip-copy-input.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import StatusRing from '#lib/components/ui/status/status-ring.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import type { MachineEnrollment } from '#lib/features/machines/state/machine-enrollment.svelte.ts';
import { cn } from '#lib/utils/utils.ts';
import EnrollmentProgressSection from './enrollment-progress-section.svelte';

const BRAND_MARK_SIZE = 32;

interface EnrollmentStepperProps {
	enrollment: MachineEnrollment;
	title: string;
	description: string;
	footer?: Snippet;
}

let { enrollment, title, description, footer }: EnrollmentStepperProps =
	$props();

const created = $derived(enrollment.created);
const connected = $derived(enrollment.progress.length > 0);
const qualified = $derived(
	connected &&
		enrollment.progress.every((entry) =>
			entry.steps.every((step) => step.status === EnrollmentStepStatus.Done)
		)
);
const failed = $derived(
	enrollment.progress.some((entry) => entry.failure !== null)
);
const installRing: StepRing = $derived.by(() => {
	if (created) return DONE;
	if (enrollment.create.isError) return FAILED;
	return ACTIVE;
});
const connectRing: StepRing = $derived.by(() => {
	if (connected) return DONE;
	return created ? ACTIVE : WAITING;
});
const qualifyRing: StepRing = $derived.by(() => {
	if (qualified) return DONE;
	if (failed) return FAILED;
	return connected ? ACTIVE : WAITING;
});

const steps = $derived([
	{
		title: 'Install',
		description: 'Run the install command on the machine.',
		ring: installRing,
		body: installBody,
	},
	{
		title: 'Connect',
		description: 'The agent connects back to Snapflow.',
		ring: connectRing,
		body: connectBody,
	},
	{
		title: 'Qualify',
		description: 'It benchmarks itself, then waits for approval.',
		ring: qualifyRing,
		body: qualifyBody,
	},
]);
const currentIndex = $derived.by(() => {
	const index = steps.findIndex((step) => step.ring !== DONE);
	return index === -1 ? steps.length - 1 : index;
});
const current = $derived(steps[currentIndex]);
</script>

{#snippet createCommandAction()}
	<Chip
		variant={enrollment.create.isError ? 'secondary' : 'primary'}
		leftIcon={enrollment.create.isError ? undefined : Terminal}
		loading={enrollment.create.isPending}
		onclick={enrollment.createDefault}
	>
		{enrollment.create.isError ? 'Try again' : 'Create install command'}
	</Chip>
{/snippet}

{#snippet installCommand()}
	{#if created}
		<ChipCopyInput
			class="font-mono"
			value={created.installCommand}
			copyLabel="Copy command"
			aria-label="Install command"
		/>
		{#if created.expiresAt}
			<p class="text-(--text-muted) text-sm">
				{created.singleUse ? 'Enrolls one machine' : 'Enrolls a fleet'}
				· Expires
				<Timestamp value={created.expiresAt} />
			</p>
		{/if}
	{:else if !enrollment.canWrite}
		<Notice
			title="Ask a member who manages machines and API keys to add a machine"
		/>
	{:else if enrollment.create.isError}
		<Notice
			tone="error"
			title="Couldn't create an install command"
			action={createCommandAction}
		/>
	{:else}
		<div>{@render createCommandAction()}</div>
	{/if}
{/snippet}

{#snippet installBody()}
	{@render installCommand()}
{/snippet}

{#snippet connectBody()}
	{@render installCommand()}
	<StatusBlock
		icon={PlugZap}
		title="Waiting for the machine"
		description="Run the command on the machine. It appears here once it connects."
	/>
{/snippet}

{#snippet qualifyBody()}
	{#if connected}
		<EnrollmentProgressSection {enrollment} />
	{/if}
{/snippet}

<div class="grid w-full gap-x-8 lg:grid-cols-[320px_minmax(0,1fr)]">
	<aside
		class="flex w-full min-w-0 flex-col justify-between gap-y-8 py-2 lg:pt-8 lg:pb-4"
	>
		<div class="flex flex-col gap-y-8">
			<div class="flex flex-col gap-y-4">
				<BrandMark size={BRAND_MARK_SIZE} />
				<div class="flex flex-col gap-y-2">
					<h1 class={PAGE_TITLE_CLASS}>{title}</h1>
					<p class="text-balance text-(--text-muted) text-sm">{description}</p>
				</div>
			</div>
			<ol class="flex flex-col gap-y-1" aria-label="Steps">
				{#each steps as item, index (item.title)}
					<li
						aria-current={index === currentIndex ? 'step' : undefined}
						class={cn(
							'flex gap-x-3 rounded-lg px-3 py-2.5 transition-colors duration-(--motion-quick)',
							index === currentIndex && 'bg-surface-3'
						)}
					>
						<StatusRing {...item.ring} class="mt-0.5 size-5 shrink-0" />
						<div class="flex min-w-0 flex-col gap-y-0.5">
							<span
								class={cn(
									'text-sm',
									index === currentIndex
										? 'text-(--text-primary)'
										: 'text-(--text-muted)'
								)}
							>
								{item.title}
							</span>
							<span class="text-(--text-subtle) text-xs">
								{item.description}
							</span>
						</div>
					</li>
				{/each}
			</ol>
		</div>
		{#if footer}
			<div class="flex min-h-10 flex-wrap items-center gap-x-4 gap-y-2">
				{@render footer()}
			</div>
		{/if}
	</aside>
	{#if current}
		<section
			aria-label={current.title}
			class="flex min-w-0 flex-1 flex-col justify-center overflow-hidden py-8 lg:min-h-[34rem] lg:rounded-xl lg:border lg:border-border lg:bg-bg lg:px-12"
		>
			<div class="mx-auto flex w-full max-w-xl flex-col gap-y-6">
				<div class="flex flex-col gap-y-2">
					<span class="text-(--text-subtle) text-sm tabular-nums">
						Step {currentIndex + 1} of {steps.length}
					</span>
					<h2 class="heading-xs">{current.title}</h2>
					<p class="text-(--text-muted) text-sm">{current.description}</p>
				</div>
				{@render current.body()}
			</div>
		</section>
	{/if}
</div>
