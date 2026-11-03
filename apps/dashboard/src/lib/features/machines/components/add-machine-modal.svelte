<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const MACHINE_SETUP_COMMAND = 'curl -fsSL https://snapflow.io/install.sh | sh';

interface AddMachineModalProps {
	open?: boolean;
}
</script>

<script lang="ts">
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	DEVICE_DECISION,
	DEVICE_PENDING_STATUS,
	deviceClaimQueryOptions,
	deviceDecisionMutationOptions,
	normalizeDeviceUserCode,
} from '#lib/api/auth/device.ts';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipCopyInput from '#lib/components/ui/chip/chip-copy-input.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalError from '#lib/components/ui/chip-modal/chip-modal-error.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';

let { open = $bindable(false) }: AddMachineModalProps = $props();

const fieldId = $props.id();
const commandId = `${fieldId}-command`;
const codeId = `${fieldId}-code`;
const codeErrorId = `${fieldId}-code-error`;
const codeHintId = `${fieldId}-code-hint`;

let code = $state('');
let userCode = $state('');

const claim = createQuery(() => ({
	...deviceClaimQueryOptions(userCode),
	enabled: userCode !== '',
}));
const decide = createMutation(() =>
	deviceDecisionMutationOptions(() => userCode)
);

const device = $derived(claim.data);
const awaitingDecision = $derived(
	device?.status === DEVICE_PENDING_STATUS && !decide.data
);
const title = $derived.by(() => {
	if (decide.data === DEVICE_DECISION.APPROVE) return 'Machine approved';
	if (decide.data === DEVICE_DECISION.DENY) return 'Request denied';
	if (awaitingDecision) return 'Approve machine';
	return 'Add machine';
});
const errorMessage = $derived.by(() => {
	if (claim.isError) return SnapflowError.fromUnknown(claim.error).message;
	if (decide.isError) return SnapflowError.fromUnknown(decide.error).message;
	if (device && device.status !== DEVICE_PENDING_STATUS && !decide.data) {
		return `This code was already ${device.status}.`;
	}
	return null;
});

function reset(): void {
	code = '';
	userCode = '';
	decide.reset();
}

function close(): void {
	open = false;
	reset();
}

function submit(): void {
	if (awaitingDecision) {
		decide.mutate(DEVICE_DECISION.APPROVE);
		return;
	}
	const normalized = normalizeDeviceUserCode(code);
	if (!normalized) return;
	decide.reset();
	if (normalized === userCode) {
		void claim.refetch();
		return;
	}
	userCode = normalized;
}
</script>

<ChipModal
	bind:open
	onOpenChange={(next) => {
		if (!next) reset();
	}}
	onsubmit={submit}
	dismissDisabled={decide.isPending}
	srTitle={title}
>
	<ChipModalHeader onClose={close} closeDisabled={decide.isPending}>
		{title}
	</ChipModalHeader>
	<ChipModalBody>
		{#if decide.data === DEVICE_DECISION.APPROVE}
			<p class="px-2 text-(--text-primary) text-sm">
				Setup continues in your terminal. The machine appears in this list once
				it connects, with its location detected from its network address.
			</p>
		{:else if decide.data === DEVICE_DECISION.DENY}
			<p class="px-2 text-(--text-primary) text-sm">
				The machine was not registered.
			</p>
		{:else if awaitingDecision && device}
			<p class="px-2 text-(--text-primary) text-sm">
				Confirm that
				<strong class="font-medium font-mono">{device.user_code}</strong>
				matches the code in your terminal.
				<span class="text-(--text-error)">
					Approving registers the machine to your organization.
				</span>
			</p>
			<ChipModalError message={errorMessage} />
		{:else}
			<ChipModalField
				label="Setup command"
				for={commandId}
				hint="Run this on the machine you want to add. Its location is detected automatically."
			>
				<ChipCopyInput
					id={commandId}
					class="font-mono"
					value={MACHINE_SETUP_COMMAND}
					copyLabel="Copy command"
				/>
			</ChipModalField>
			<ChipModalField
				label="Device code"
				for={codeId}
				required
				error={errorMessage}
				errorId={codeErrorId}
				hintId={codeHintId}
				hint="Enter the code setup prints, or open its link on any device."
			>
				<ChipInput
					id={codeId}
					autocomplete="off"
					autocapitalize="characters"
					placeholder="ABCD-EFGH"
					class="font-mono"
					aria-describedby={errorMessage ? codeErrorId : codeHintId}
					aria-invalid={errorMessage ? true : undefined}
					bind:value={code}
					error={Boolean(errorMessage)}
				/>
			</ChipModalField>
		{/if}
	</ChipModalBody>
	{#if decide.data}
		<ChipModalFooter hideCancel>
			{#snippet primaryAction(
				initialFocus
			)}
				<ChipModalAction
					variant="primary"
					onclick={close}
					{@attach initialFocus}
				>
					Done
				</ChipModalAction>
			{/snippet}
		</ChipModalFooter>
	{:else if awaitingDecision}
		<ChipModalFooter onCancel={close} cancelDisabled={decide.isPending}>
			{#snippet primaryAdjacentAction()}
				<Chip
					disabled={decide.isPending}
					onclick={() => decide.mutate(DEVICE_DECISION.DENY)}
				>
					{decide.isPending && decide.variables === DEVICE_DECISION.DENY
						? 'Denying...'
						: 'Deny'}
				</Chip>
			{/snippet}
			{#snippet primaryAction(
				initialFocus
			)}
				<ChipModalAction
					type="submit"
					variant="primary"
					disabled={decide.isPending}
					{@attach initialFocus}
				>
					{decide.isPending && decide.variables === DEVICE_DECISION.APPROVE
						? 'Approving...'
						: 'Approve'}
				</ChipModalAction>
			{/snippet}
		</ChipModalFooter>
	{:else}
		<ChipModalFooter onCancel={close}>
			{#snippet primaryAction(
				initialFocus
			)}
				<ChipModalAction
					type="submit"
					variant="primary"
					disabled={!normalizeDeviceUserCode(code) || claim.isFetching}
					{@attach initialFocus}
				>
					{claim.isFetching ? 'Checking...' : 'Continue'}
				</ChipModalAction>
			{/snippet}
		</ChipModalFooter>
	{/if}
</ChipModal>
