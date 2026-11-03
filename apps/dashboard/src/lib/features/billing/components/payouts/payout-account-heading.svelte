<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Landmark from '@lucide/svelte/icons/landmark';
import type { PayoutAccount } from '@snapflow/api-client';
import Badge from '#lib/components/ui/badge.svelte';
import BillingHeading from '#lib/features/billing/components/billing-heading.svelte';
import { payoutAccountHeadline } from '#lib/features/billing/lib/payout-onboarding.ts';

interface PayoutAccountHeadingProps {
	account: PayoutAccount | null;
}

let { account }: PayoutAccountHeadingProps = $props();

const headline = $derived(payoutAccountHeadline(account));
</script>

{#snippet badge()}
	<Badge dot size="sm" variant={headline.badge.variant}>
		{headline.badge.label}
	</Badge>
{/snippet}

<BillingHeading
	icon={Landmark}
	title={headline.title}
	detail={headline.description}
	trailing={badge}
/>
