<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { BadgeVariant } from '#lib/components/ui/badge.svelte';
import type {
	StatusRingShape,
	StatusRingTone,
} from '#lib/components/ui/status/status-ring.svelte';

export type ResourceStateBadgeVariant = 'pill' | 'inline';

type StateKind = 'success' | 'error' | 'transitional' | 'attention' | 'idle';

const ERROR_STATES: ReadonlySet<string> = new Set([
	'build_failed',
	'delisted',
	'denied',
	'error',
	'failed',
	'forfeited',
	'lost',
	'machine_unavailable',
	'suspended',
	'unhealthy',
]);
const TRANSITIONAL_STATES: ReadonlySet<string> = new Set([
	'archiving',
	'building',
	'building_snapshot',
	'capturing',
	'creating',
	'deleting',
	'destroying',
	'forking',
	'pausing',
	'pending',
	'pending_build',
	'pending_placement',
	'pulling',
	'resizing',
	'restoring',
	'resuming',
	'snapshotting',
	'starting',
	'stopping',
]);
const ATTENTION_STATES: ReadonlySet<string> = new Set([
	'deferred',
	'needs_response',
	'open',
	'requires_action',
	'throttled',
	'under_review',
]);
const SUCCESS_STATES: ReadonlySet<string> = new Set([
	'active',
	'approved',
	'available',
	'cleared',
	'healthy',
	'passed',
	'ready',
	'resolved',
	'running',
	'started',
	'succeeded',
	'transferred',
	'won',
]);

const KIND_BADGE: Record<StateKind, BadgeVariant> = {
	success: 'success',
	error: 'error',
	transitional: 'neutral',
	attention: 'warning',
	idle: 'neutral',
};

const KIND_RING: Record<
	StateKind,
	{ shape: StatusRingShape; tone: StatusRingTone }
> = {
	success: { shape: 'check', tone: 'success' },
	error: { shape: 'cross', tone: 'error' },
	transitional: { shape: 'dashed', tone: 'neutral' },
	attention: { shape: 'alert', tone: 'warning' },
	idle: { shape: 'empty', tone: 'neutral' },
};

function stateKind(state: string): StateKind {
	if (SUCCESS_STATES.has(state)) return 'success';
	if (ERROR_STATES.has(state)) return 'error';
	if (TRANSITIONAL_STATES.has(state)) return 'transitional';
	if (ATTENTION_STATES.has(state)) return 'attention';
	return 'idle';
}

function sentenceCase(value: string): string {
	const spaced = value.replaceAll('_', ' ');
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
</script>

<script lang="ts">
import Badge from '#lib/components/ui/badge.svelte';
import StatusRing from '#lib/components/ui/status/status-ring.svelte';
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';

interface ResourceStateBadgeProps {
	readonly errorReason?: string | null;
	readonly label?: string;
	readonly state?: string;
	readonly variant?: ResourceStateBadgeVariant;
}

let {
	errorReason,
	label,
	state,
	variant = 'pill',
}: ResourceStateBadgeProps = $props();

const normalizedState = $derived(state?.trim().toLowerCase() || 'unknown');
const kind = $derived(stateKind(normalizedState));
const ring = $derived(KIND_RING[kind]);
const text = $derived(label ?? sentenceCase(normalizedState));
</script>

{#snippet icon(extra: Record<string, unknown>)}
	<span {...extra} class="inline-flex shrink-0">
		<StatusRing
			shape={ring.shape}
			tone={ring.tone}
			live={kind === 'transitional'}
		/>
	</span>
{/snippet}

{#if variant === 'pill'}
	<Badge
		variant={KIND_BADGE[kind]}
		size="sm"
		live={kind === 'transitional'}
		tooltip={errorReason ?? undefined}
	>
		{text}
	</Badge>
{:else}
	<span
		class="inline-flex min-w-0 items-center gap-2 text-(--text-primary) text-sm"
	>
		{#if errorReason}
			<Tooltip content={errorReason}>
				{#snippet child({ props })}
					{@render icon({ ...props, tabindex: 0 })}
				{/snippet}
			</Tooltip>
		{:else}
			{@render icon({})}
		{/if}
		<span class="truncate">{text}</span>
	</span>
{/if}
