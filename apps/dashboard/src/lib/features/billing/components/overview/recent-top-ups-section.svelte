<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { type TopUp, TopUpKind, TopUpState } from '@snapflow/api-client';

type ListedState =
	| typeof TopUpState.Succeeded
	| typeof TopUpState.RequiresAction
	| typeof TopUpState.Failed;

const STATE_BADGES = {
	[TopUpState.Succeeded]: { label: 'Paid', variant: 'green' },
	[TopUpState.RequiresAction]: {
		label: 'Needs authentication',
		variant: 'amber',
	},
	[TopUpState.Failed]: { label: 'Failed', variant: 'red' },
} as const satisfies Record<
	ListedState,
	{ label: string; variant: 'green' | 'amber' | 'red' }
>;

const KIND_LABELS = {
	[TopUpKind.Manual]: 'Top-up',
	[TopUpKind.Auto]: 'Automatic top-up',
} as const satisfies Record<TopUpKind, string>;

function isListed(topUp: TopUp): topUp is TopUp & { state: ListedState } {
	return (
		topUp.state === TopUpState.Succeeded ||
		topUp.state === TopUpState.RequiresAction ||
		(topUp.state === TopUpState.Failed && topUp.kind === TopUpKind.Auto)
	);
}
</script>

<script lang="ts">
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import { formatBillingDate } from '#lib/features/billing/lib/format.ts';
import { formatCents } from '#lib/utils/usd.ts';

interface RecentTopUpsSectionProps {
	topUps: readonly TopUp[];
}

let { topUps }: RecentTopUpsSectionProps = $props();

const listed = $derived(topUps.filter(isListed));
</script>

{#if listed.length > 0}
	<SettingsSection title="Top-ups">
		<div class="-mx-2 flex flex-col gap-y-0.5">
			{#each listed as topUp (topUp.id)}
				{const badge = $derived(STATE_BADGES[topUp.state])}
				<div class="flex items-center gap-2.5 rounded-lg p-2">
					<span class="w-28 shrink-0 text-(--text-body) text-sm">
						{formatBillingDate(topUp.succeededAt ?? topUp.createdAt)}
					</span>
					<Badge size="sm" variant={badge.variant}>{badge.label}</Badge>
					<span
						class="min-w-0 flex-1 truncate text-(--text-muted) text-caption"
					>
						{KIND_LABELS[topUp.kind]}
					</span>
					<span class="shrink-0 text-(--text-muted) text-caption tabular-nums">
						{formatCents(topUp.amountCents)}
					</span>
				</div>
			{/each}
		</div>
	</SettingsSection>
{/if}
