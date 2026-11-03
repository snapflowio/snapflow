<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { DrainingMode, type SetDrainingPolicy } from '@snapflow/api-client';

const DRAINING_MODE_OPTIONS = [
	{ label: 'Migrate', value: DrainingMode.Migrate },
	{ label: 'Archive', value: DrainingMode.Archive },
] as const;

const DRAINING_MODE_DESCRIPTIONS: Record<DrainingMode, string> = {
	[DrainingMode.Migrate]:
		'Stopped sandboxes on a draining machine move to other machines.',
	[DrainingMode.Archive]:
		'Stopped sandboxes on a draining machine are archived.',
};

interface DrainingPolicyModalProps {
	current: SetDrainingPolicy;
	onSave: (policy: SetDrainingPolicy) => void;
	open?: boolean;
	pending: boolean;
}
</script>

<script lang="ts">
import ChipSwitch from '#lib/components/ui/chip/chip-switch.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import Label from '#lib/components/ui/label.svelte';
import Switch from '#lib/components/ui/switch.svelte';

let {
	current,
	onSave,
	open = $bindable(false),
	pending,
}: DrainingPolicyModalProps = $props();

const forceId = $props.id();
let mode = $derived(current.mode);
let force = $derived(current.force);
const changed = $derived(mode !== current.mode || force !== current.force);
const disabled = $derived(!changed || pending);

function close() {
	open = false;
}

function submit() {
	if (!disabled) onSave({ mode, force });
}
</script>

<ChipModal
	bind:open
	onsubmit={submit}
	srTitle="Machine draining"
	dismissDisabled={pending}
>
	<ChipModalHeader onClose={close} closeDisabled={pending}>
		Machine draining
	</ChipModalHeader>
	<ChipModalBody>
		<ChipModalField label="Mode" hint={DRAINING_MODE_DESCRIPTIONS[mode]}>
			<ChipSwitch
				aria-label="Draining mode"
				options={DRAINING_MODE_OPTIONS}
				bind:value={mode}
			/>
		</ChipModalField>
		<div class="flex items-center justify-between gap-4 px-2">
			<div class="flex min-w-0 flex-col gap-1">
				<Label for={forceId}>Force</Label>
				<p class="text-(--text-muted) text-caption">
					Stop running sandboxes so drains finish instead of waiting for them.
				</p>
			</div>
			<Switch id={forceId} bind:checked={force} />
		</div>
	</ChipModalBody>
	<ChipModalFooter onCancel={close} cancelDisabled={pending}>
		{#snippet primaryAction(
			initialFocus
		)}
			<ChipModalAction
				type="submit"
				variant="primary"
				{disabled}
				{@attach initialFocus}
			>
				{pending ? 'Saving...' : 'Save'}
			</ChipModalAction>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
