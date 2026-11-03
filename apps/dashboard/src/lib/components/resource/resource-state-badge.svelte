<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { BadgeProps } from '#lib/components/ui/badge.svelte';

const ERROR_STATES = new Set([
	'delisted',
	'error',
	'failed',
	'forfeited',
	'lost',
	'unhealthy',
]);
const PENDING_STATES = new Set([
	'building',
	'creating',
	'deleting',
	'destroying',
	'needs_response',
	'open',
	'pending',
	'pulling',
	'requires_action',
	'starting',
	'stopping',
	'under_review',
]);
const SUCCESS_STATES = new Set([
	'active',
	'available',
	'cleared',
	'healthy',
	'passed',
	'ready',
	'running',
	'started',
	'succeeded',
	'transferred',
	'won',
]);

function stateVariant(state: string): BadgeProps['variant'] {
	if (SUCCESS_STATES.has(state)) return 'green';
	if (ERROR_STATES.has(state)) return 'red';
	if (PENDING_STATES.has(state)) return 'amber';
	return 'gray-secondary';
}
</script>

<script lang="ts">
import Badge from '#lib/components/ui/badge.svelte';
import TooltipContent from '#lib/components/ui/tooltip/tooltip-content.svelte';
import TooltipRoot from '#lib/components/ui/tooltip/tooltip-root.svelte';
import TooltipTrigger from '#lib/components/ui/tooltip/tooltip-trigger.svelte';
import { titleCase } from '#lib/utils/text.ts';

interface ResourceStateBadgeProps {
	readonly errorReason?: string | null;
	readonly state?: string;
}

let { errorReason, state }: ResourceStateBadgeProps = $props();

const normalizedState = $derived(state?.trim().toLowerCase() || 'unknown');
const variant = $derived(stateVariant(normalizedState));
</script>

{#snippet badge(
	props: Record<string, unknown>
)}
	<Badge dot size="sm" {variant} {...props}>
		{titleCase(normalizedState)}
	</Badge>
{/snippet}

{#if errorReason}
	<TooltipRoot>
		<TooltipTrigger>
			{#snippet child({
				props,
			})}
				{@render badge(props)}
			{/snippet}
		</TooltipTrigger>
		<TooltipContent class="max-w-xs wrap-break-word">
			{errorReason}
		</TooltipContent>
	</TooltipRoot>
{:else}
	{@render badge({})}
{/if}
