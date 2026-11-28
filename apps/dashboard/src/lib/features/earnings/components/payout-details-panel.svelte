<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { HostPayout } from '@snapflow/api-client';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import ResourceDetailsPanel from '#lib/components/resource/resource-details-panel.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import AddressDisplay from '#lib/components/ui/address/address-display.svelte';
import Money from '#lib/components/ui/money.svelte';
import StatusLabel from '#lib/components/ui/status/status-label.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import {
	EARNINGS_STATUS,
	statusLabelProps,
} from '#lib/features/earnings/lib/earnings-status.ts';
import { shortAddress } from '#lib/features/wallet/lib/payment-wallet.ts';

interface PayoutDetailsPanelProps {
	payout: HostPayout | null;
	retiredLabel: string;
	onClose: () => void;
}

let { payout, retiredLabel, onClose }: PayoutDetailsPanelProps = $props();
</script>

<ResourceDetailsPanel
	open={payout !== null}
	title={payout ? (payout.machineName ?? retiredLabel) : 'Payout'}
	{onClose}
>
	{#if payout}
		<div class="flex flex-col gap-y-8 pt-2">
			<SettingsSection title="Payout">
				<KeyValueList framed={false}>
					<KeyValueRow label="Status">
						<StatusLabel {...statusLabelProps(EARNINGS_STATUS.paidOut)} />
					</KeyValueRow>
					<KeyValueRow label="Paid">
						<Timestamp value={payout.paidAt} />
					</KeyValueRow>
					<KeyValueRow label="Gross">
						<Money microUsd={payout.grossMicroUsd} />
					</KeyValueRow>
					<KeyValueRow label="Network fee">
						<Money microUsd={payout.feeMicroUsd} precise />
					</KeyValueRow>
					<KeyValueRow label="Net">
						<Money microUsd={payout.netMicroUsd} />
					</KeyValueRow>
				</KeyValueList>
			</SettingsSection>
			<SettingsSection title="Transaction">
				<KeyValueList framed={false}>
					<KeyValueRow label="Transaction">
						<AddressDisplay kind="tx" value={payout.transactionHash} />
					</KeyValueRow>
					<KeyValueRow label="Pays to">
						<AddressDisplay value={payout.payoutAddress} />
					</KeyValueRow>
					<KeyValueRow label="Machine key">
						<AddressDisplay value={payout.hostAddress} />
					</KeyValueRow>
				</KeyValueList>
			</SettingsSection>
			{#if payout.claims.length > 0}
				<SettingsSection title="Claims">
					<KeyValueList framed={false}>
						{#each payout.claims as claim, index (index)}
							<KeyValueRow label={`Channel ${shortAddress(claim.channelId)}`}>
								<span class="inline-flex min-w-0 items-center gap-3">
									<AddressDisplay kind="tx" value={claim.transactionHash} />
									<Money microUsd={claim.amountMicroUsd} />
								</span>
							</KeyValueRow>
						{/each}
					</KeyValueList>
				</SettingsSection>
			{/if}
		</div>
	{/if}
</ResourceDetailsPanel>
