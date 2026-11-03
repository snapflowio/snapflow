<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { PayoutAccountType } from '@snapflow/api-client';
import type { ChipSwitchOption } from '#lib/components/ui/chip/chip-switch.svelte';

const ACCOUNT_TYPE_OPTIONS: readonly ChipSwitchOption<PayoutAccountType>[] = [
	{ value: PayoutAccountType.Individual, label: 'Individual' },
	{ value: PayoutAccountType.Company, label: 'Business' },
];
</script>

<script lang="ts">
import QueryFeedbackState from '#lib/components/query-feedback-state.svelte';
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import ChipSwitch from '#lib/components/ui/chip/chip-switch.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import type { PayoutAccountSetup } from '#lib/features/billing/state/payout-account-setup.svelte.ts';

interface PayoutAccountModalProps {
	setup: PayoutAccountSetup;
}

let { setup }: PayoutAccountModalProps = $props();

function close(): void {
	if (setup.pending) return;
	setup.open = false;
}
</script>

<ChipModal
	bind:open={setup.open}
	dismissDisabled={setup.pending}
	srTitle="Set up payouts"
>
	<ChipModalHeader onClose={close} closeDisabled={setup.pending}>
		Set up payouts
	</ChipModalHeader>
	<ChipModalBody>
		{#if setup.config.isSuccess}
			<ChipModalField label="Country" hint="Where your bank account is.">
				<ChipDropdown
					fullWidth
					aria-label="Country"
					options={setup.countries}
					placeholder="Select a country"
					searchable
					searchPlaceholder="Search countries..."
					disabled={setup.pending}
					bind:value={setup.country}
				/>
			</ChipModalField>
			<ChipModalField
				label="Paid as"
				hint="Choose business only if a registered company receives the money."
			>
				<ChipSwitch
					aria-label="Paid as"
					options={ACCOUNT_TYPE_OPTIONS}
					disabled={setup.pending}
					bind:value={setup.type}
				/>
			</ChipModalField>
		{:else}
			<QueryFeedbackState
				class="min-h-0 py-4"
				query={setup.config}
				loadingMessage="Loading payout countries..."
				errorMessage="Payout countries could not be loaded."
			/>
		{/if}
	</ChipModalBody>
	<ChipModalFooter onCancel={close} cancelDisabled={setup.pending}>
		{#snippet primaryAction()}
			<ChipModalAction
				variant="primary"
				disabled={!setup.canSubmit}
				onclick={() => setup.submit()}
			>
				{setup.pending ? 'Creating...' : 'Continue'}
			</ChipModalAction>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
