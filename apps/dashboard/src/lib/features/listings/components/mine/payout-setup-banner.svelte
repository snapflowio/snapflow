<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { PayoutReadiness } from '@snapflow/api-client';

type UnreadyPayout = Exclude<PayoutReadiness, typeof PayoutReadiness.Ready>;

const BANNER_COPY = {
	[PayoutReadiness.NotSetUp]: {
		message: 'Link a payout wallet to list machines publicly.',
		action: 'Link payout wallet',
	},
	[PayoutReadiness.Blocked]: {
		message:
			'Your payout wallet failed sanctions screening, so public listings are paused. Link a different wallet.',
		action: 'Replace wallet',
	},
} as const satisfies Record<UnreadyPayout, { message: string; action: string }>;
</script>

<script lang="ts">
import Chip from '#lib/components/ui/chip/chip.svelte';
import { Path } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';

interface PayoutSetupBannerProps {
	readiness: UnreadyPayout;
	canManage: boolean;
}

let { readiness, canManage }: PayoutSetupBannerProps = $props();

const copy = $derived(BANNER_COPY[readiness]);
</script>

<div role="status" class="shrink-0 bg-surface-active px-4 py-2.5 md:px-6">
	<div class="flex items-center justify-between gap-3">
		<p class="min-w-0 text-small">
			{copy.message}
			{#if !canManage}
				<span class="text-(--text-muted)">
					A member who manages payouts can link one.
				</span>
			{/if}
		</p>
		{#if canManage}
			<Chip
				class="h-7 shrink-0 px-2 text-caption"
				href={resolve(Path.EARNINGS_PAYOUTS)}
			>
				{copy.action}
			</Chip>
		{/if}
	</div>
</div>
