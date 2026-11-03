<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import PageColumn from '#lib/components/page/page-column.svelte';
import QueryFeedbackState from '#lib/components/query-feedback-state.svelte';
import EarningsHeader from '#lib/features/billing/components/earnings-header.svelte';
import PayoutAccountHeading from '#lib/features/billing/components/payouts/payout-account-heading.svelte';
import PayoutAccountModal from '#lib/features/billing/components/payouts/payout-account-modal.svelte';
import PayoutConnectView from '#lib/features/billing/components/payouts/payout-connect-view.svelte';
import {
	isPayoutAccountVerified,
	PAYOUT_SETUP_PARAM,
} from '#lib/features/billing/lib/payout-onboarding.ts';
import { PayoutAccountSetup } from '#lib/features/billing/state/payout-account-setup.svelte.ts';
import { PayoutOnboarding } from '#lib/features/billing/state/payout-onboarding.svelte.ts';
import OrganizationPermissionGate from '#lib/features/organizations/components/organization-permission-gate.svelte';
import { consumeSearchParam } from '#lib/routing/consume-search-param.svelte.ts';

const onboarding = new PayoutOnboarding();
const setup = new PayoutAccountSetup();
const verified = $derived(
	onboarding.account !== null && isPayoutAccountVerified(onboarding.account)
);
const actions = $derived<HeaderAction[]>(
	onboarding.missing && onboarding.canManage
		? [
				{
					id: 'set-up-payouts',
					kind: 'primary',
					label: 'Set up payouts',
					onSelect: () => {
						setup.open = true;
					},
				},
			]
		: []
);

consumeSearchParam(
	PAYOUT_SETUP_PARAM,
	() => {
		if (onboarding.missing && onboarding.canManage) setup.open = true;
	},
	() => onboarding.resolved
);
</script>

<EarningsHeader {actions} />
<OrganizationPermissionGate
	label="the payout account"
	permission={{ payouts: ['manage'] }}
>
	{#if onboarding.resolved}
		<PageColumn>
			<PayoutAccountHeading account={onboarding.account} />
			{#if onboarding.account}
				<PayoutConnectView
					{verified}
					onAccountChanged={() => void onboarding.query.refetch()}
				/>
			{/if}
		</PageColumn>
		<PayoutAccountModal {setup} />
	{:else}
		<QueryFeedbackState
			query={onboarding.query}
			loadingMessage="Loading the payout account..."
			errorMessage="The payout account could not be loaded."
		/>
	{/if}
</OrganizationPermissionGate>
