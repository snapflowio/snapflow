<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { MachineEnrollmentKey } from '@snapflow/api-client';
import { joinFacts } from '#lib/features/earnings/lib/earnings-copy.ts';
import { enrollmentKeyKindLabel } from '#lib/features/machines/lib/enrollment-key.ts';
import { pluralize } from '#lib/utils/text.ts';

const KEY_PREFIX_SUFFIX = '…';

function keyMeta(key: MachineEnrollmentKey): string {
	return joinFacts([
		enrollmentKeyKindLabel(key),
		pluralize(key.machineCount, 'machine'),
		key.start ? `${key.start}${KEY_PREFIX_SUFFIX}` : null,
	]);
}
</script>

<script lang="ts">
import Ban from '@lucide/svelte/icons/ban';
import Eye from '@lucide/svelte/icons/eye';
import KeyRound from '@lucide/svelte/icons/key-round';
import EmptyState from '#lib/components/empty-state.svelte';
import FeedbackState from '#lib/components/feedback-state.svelte';
import SettingsResourceRow from '#lib/components/settings/settings-resource-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Skeleton, {
	SKELETON_SECTION_ROWS,
} from '#lib/components/ui/skeleton/skeleton.svelte';
import { enrollmentKeyBadge } from '#lib/features/machines/lib/enrollment-key.ts';
import type { MachineEnrollment } from '#lib/features/machines/state/machine-enrollment.svelte.ts';

interface EnrollmentKeysSectionProps {
	enrollment: MachineEnrollment;
	onWatch: () => void;
}

let { enrollment, onWatch }: EnrollmentKeysSectionProps = $props();

const keys = $derived(enrollment.keys.data?.items ?? []);
</script>

<SettingsSection
	title="Keys"
	info="Revoking a key stops new machines from enrolling with it. Machines it enrolled keep running."
>
	{#if enrollment.keys.isSuccess}
		<div class="flex flex-col gap-y-0.5">
			{#each keys as key (key.id)}
				{const badge = $derived(enrollmentKeyBadge(key, enrollment.now))}
				{#snippet status()}
					<Badge size="sm" variant={badge.variant}>{badge.label}</Badge>
				{/snippet}
				<SettingsResourceRow
					icon={KeyRound}
					title={key.name ?? 'Enrollment key'}
					meta={keyMeta(key)}
					badge={status}
					dimmed={!key.enabled}
					actionsLabel={`Actions for ${key.name ?? 'enrollment key'}`}
					actions={[
						{
							icon: Eye,
							label: 'Show progress',
							onSelect: () => {
								enrollment.watch(key);
								onWatch();
							},
							visible: enrollment.watchedKey?.id !== key.id,
						},
						{
							icon: Ban,
							label: 'Revoke',
							destructive: true,
							disabled: enrollment.revoke.isPending || !key.enabled,
							onSelect: () => (enrollment.revoking = key),
						},
					]}
				/>
			{:else}
				<EmptyState
					icon={KeyRound}
					title="No enrollment keys yet"
					description="Keys you create to enroll machines show up here."
				/>
			{/each}
		</div>
	{:else if enrollment.keys.isError}
		<FeedbackState
			variant="inline"
			tone="error"
			resource="enrollment keys"
			error={enrollment.keys.error}
			retrying={enrollment.keys.isFetching}
			onRetry={() => void enrollment.keys.refetch()}
		/>
	{:else}
		<Skeleton class="h-9" repeat={SKELETON_SECTION_ROWS} fade />
	{/if}
</SettingsSection>
