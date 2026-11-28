<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type {
	StatusRingShape,
	StatusRingTone,
} from '#lib/components/ui/status/status-ring.svelte';
import { EnrollmentStepStatus } from '#lib/features/machines/lib/enrollment-progress.ts';

export const ENROLLMENT_STEP_RINGS = {
	[EnrollmentStepStatus.Done]: { shape: 'check', tone: 'success', live: false },
	[EnrollmentStepStatus.Current]: {
		shape: 'half',
		tone: 'neutral',
		live: true,
	},
	[EnrollmentStepStatus.Waiting]: {
		shape: 'empty',
		tone: 'neutral',
		live: false,
	},
	[EnrollmentStepStatus.Failed]: { shape: 'cross', tone: 'error', live: false },
} as const satisfies Record<
	EnrollmentStepStatus,
	{ shape: StatusRingShape; tone: StatusRingTone; live: boolean }
>;
</script>

<script lang="ts">
import Chip from '#lib/components/ui/chip/chip.svelte';
import StatusLabel from '#lib/components/ui/status/status-label.svelte';
import {
	awaitsListing,
	EnrollmentFailureAction,
} from '#lib/features/machines/lib/enrollment-progress.ts';
import { machineRatesHref } from '#lib/features/machines/lib/machine-listing-link.ts';
import type { MachineEnrollment } from '#lib/features/machines/state/machine-enrollment.svelte.ts';
import { resolve } from '$app/paths';

interface EnrollmentProgressSectionProps {
	enrollment: MachineEnrollment;
}

let { enrollment }: EnrollmentProgressSectionProps = $props();
</script>

<ul class="flex flex-col gap-2">
	{#each enrollment.progress as entry (entry.machine.id)}
		<li class="flex flex-col gap-3 rounded-xl bg-surface-3 px-5 py-4">
			<div class="flex items-center justify-between gap-3">
				<a
					href={resolve('/(app)/(dashboard)/machines/[machineId]', {
						machineId: entry.machine.id,
					})}
					class="truncate font-medium text-(--text-primary) text-sm underline-offset-4 hover-hover:underline"
				>
					{entry.machine.name}
				</a>
				{#if entry.failure}
					<div class="flex shrink-0 items-center gap-1.5">
						{#each entry.failureActions as action (action)}
							{#if action === EnrollmentFailureAction.RetryBenchmark}
								{#if enrollment.canRequestBenchmark}
									<Chip
										size="compact"
										loading={enrollment.requestBenchmark.isPending}
										onclick={() =>
											enrollment.requestBenchmark.mutate(entry.machine.id)}
									>
										Retry benchmark
									</Chip>
								{/if}
							{:else}
								<Chip
									size="compact"
									href={resolve(
										'/(app)/(dashboard)/machines/[machineId]/health',
										{
											machineId: entry.machine.id,
										}
									)}
								>
									View health
								</Chip>
							{/if}
						{/each}
					</div>
				{:else if awaitsListing(entry.machine)}
					<Chip size="compact" href={machineRatesHref(entry.machine.id)}>
						Set rates
					</Chip>
				{/if}
			</div>
			<ol class="flex flex-wrap items-center gap-x-4 gap-y-1.5">
				{#each entry.steps as step (step.label)}
					<li>
						<StatusLabel
							label={step.label}
							{...ENROLLMENT_STEP_RINGS[step.status]}
						/>
					</li>
				{/each}
			</ol>
			{#if entry.failure}
				<p class="text-(--text-error) text-xs">{entry.failure}</p>
			{/if}
		</li>
	{/each}
</ul>
