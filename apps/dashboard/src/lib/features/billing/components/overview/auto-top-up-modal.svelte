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
import { createMutation } from '@tanstack/svelte-query';
import { watch } from 'runed';
import { updateAutoTopUpMutationOptions } from '#lib/api/billing/billing.ts';
import SettingsToggleRow from '#lib/components/settings/settings-toggle-row.svelte';
import LabeledCheckbox from '#lib/components/ui/checkbox/labeled-checkbox.svelte';
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipInputPrefix from '#lib/components/ui/chip/chip-input-prefix.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalError from '#lib/components/ui/chip-modal/chip-modal-error.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import { formatPaymentMethod } from '#lib/features/billing/lib/format.ts';
import {
	autoTopUpCadence,
	NO_REFUNDS_NOTICE,
} from '#lib/features/billing/lib/top-up-limits.ts';
import { AutoTopUpDraft } from '#lib/features/billing/state/auto-top-up-draft.svelte.ts';
import { formatCents } from '#lib/utils/usd.ts';

interface AutoTopUpModalProps {
	open?: boolean;
	config: BillingConfig;
	methods: readonly PaymentMethod[];
	policy: AutoTopUp;
}

let {
	open = $bindable(false),
	config,
	methods,
	policy,
}: AutoTopUpModalProps = $props();

const fieldId = $props.id();
const ids = {
	threshold: `${fieldId}-threshold`,
	amount: `${fieldId}-amount`,
};
const draft = new AutoTopUpDraft(() => ({ config, methods, policy }));
const save = createMutation(() => updateAutoTopUpMutationOptions());
const cadence = $derived(autoTopUpCadence(config));
const cardOptions = $derived(
	methods.map((method) => ({
		label: formatPaymentMethod(method),
		value: method.id,
	}))
);
const consentText = $derived(
	draft.thresholdCents !== null && draft.amountCents !== null && draft.card
		? `Charge ${formatPaymentMethod(draft.card)} ${formatCents(draft.amountCents)} whenever credit falls below ${formatCents(draft.thresholdCents)}, ${cadence}, until I turn this off.`
		: `Charge the selected card automatically, ${cadence}, until I turn this off.`
);
const canSave = $derived(
	draft.dirty && draft.valid && !save.isPending && methods.length > 0
);

watch(
	() => open,
	(isOpen) => {
		if (isOpen) draft.discard();
	}
);

function isConsented(): boolean {
	return draft.consented;
}

function setConsented(checked: boolean): void {
	draft.consented = checked;
}

function close(): void {
	if (save.isPending) return;
	open = false;
}

function submit(event: SubmitEvent): void {
	event.preventDefault();
	const next = canSave ? draft.policy() : null;
	if (!next) return;
	save.mutate(
		{ policy: next, resourceVersion: draft.resourceVersion },
		{
			onSuccess: () => {
				open = false;
			},
		}
	);
}
</script>

{#snippet dollarPrefix()}
	<ChipInputPrefix>$</ChipInputPrefix>
{/snippet}

<ChipModal
	bind:open
	dismissDisabled={save.isPending}
	srTitle="Automatic top-up"
	onsubmit={submit}
>
	<ChipModalHeader onClose={close} closeDisabled={save.isPending}>
		Automatic top-up
	</ChipModalHeader>
	<ChipModalBody>
		<ChipModalField>
			<SettingsToggleRow
				label="Top up automatically"
				disabled={save.isPending}
				bind:checked={draft.enabled}
			/>
		</ChipModalField>
		<ChipModalField label="When credit falls below" for={ids.threshold}>
			<ChipInput
				id={ids.threshold}
				required
				inputmode="decimal"
				bind:value={draft.threshold}
				startAdornment={dollarPrefix}
			/>
		</ChipModalField>
		<ChipModalField
			label="Add"
			for={ids.amount}
			hint={`At least ${formatCents(config.autoTopUpMinimumCents)}.`}
		>
			<ChipInput
				id={ids.amount}
				required
				inputmode="decimal"
				bind:value={draft.amount}
				startAdornment={dollarPrefix}
			/>
		</ChipModalField>
		<ChipModalField label="Card">
			<ChipDropdown
				aria-label="Card"
				fullWidth
				options={cardOptions}
				value={draft.paymentMethodId}
				onChange={(value: string) => {
					draft.paymentMethodId = value;
				}}
			/>
		</ChipModalField>
		{#if draft.enabled}
			<ChipModalField>
				<LabeledCheckbox
					bind:checked={isConsented, setConsented}
					description={NO_REFUNDS_NOTICE}
				>
					{consentText}
				</LabeledCheckbox>
			</ChipModalField>
		{/if}
		<ChipModalError message={draft.amountsError} />
	</ChipModalBody>
	<ChipModalFooter onCancel={close} cancelDisabled={save.isPending}>
		{#snippet primaryAction()}
			<ChipModalAction type="submit" variant="primary" disabled={!canSave}>
				{save.isPending ? 'Saving...' : 'Save'}
			</ChipModalAction>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
