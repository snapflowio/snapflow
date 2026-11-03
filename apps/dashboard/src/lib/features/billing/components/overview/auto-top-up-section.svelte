<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type {
	AutoTopUp,
	BillingConfig,
	PaymentMethod,
} from '@snapflow/api-client';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import { formatPaymentMethod } from '#lib/features/billing/lib/format.ts';
import { formatCents } from '#lib/utils/usd.ts';
import AutoTopUpModal from './auto-top-up-modal.svelte';

interface AutoTopUpSectionProps {
	canManage: boolean;
	config: BillingConfig;
	methods: readonly PaymentMethod[];
	policy: AutoTopUp;
}

let { canManage, config, methods, policy }: AutoTopUpSectionProps = $props();

let open = $state(false);
const card = $derived(
	methods.find((method) => method.id === policy.paymentMethodId)
);
const title = $derived(
	policy.enabled
		? `Add ${formatCents(policy.amountCents)} when credit falls below ${formatCents(policy.thresholdCents)}`
		: 'Off'
);
const detail = $derived(
	policy.suspendedReason ??
		(methods.length === 0
			? 'Save a card at checkout to turn this on.'
			: policy.enabled && card
				? `Charges ${formatPaymentMethod(card)}`
				: null)
);
</script>

<SettingsSection title="Automatic top-up">
	<div class="flex items-center justify-between gap-4">
		<div class="flex min-w-0 flex-col gap-1">
			<div class="flex min-w-0 items-center gap-2">
				<span class="truncate text-(--text-body) text-small">{title}</span>
				{#if policy.suspendedReason}
					<Badge size="sm" variant="amber">Paused</Badge>
				{/if}
			</div>
			{#if detail}
				<p class="text-(--text-muted) text-caption">{detail}</p>
			{/if}
		</div>
		{#if canManage && methods.length > 0}
			<Chip onclick={() => (open = true)}>
				{policy.configured ? 'Edit' : 'Set up'}
			</Chip>
		{/if}
	</div>
</SettingsSection>
{#if canManage && methods.length > 0}
	<AutoTopUpModal bind:open {config} {methods} {policy} />
{/if}
