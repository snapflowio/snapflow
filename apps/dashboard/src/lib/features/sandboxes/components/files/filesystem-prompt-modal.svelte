<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const INVALID_NAMES: ReadonlySet<string> = new Set(['', '.', '..']);
const PATH_SEPARATOR = '/';
</script>

<script lang="ts">
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';

interface FilesystemPromptModalProps {
	mode: 'create' | 'rename';
	onSubmit: (value: string) => Promise<void>;
}

let { mode, onSubmit }: FilesystemPromptModalProps = $props();

const inputId = $props.id();
let open = $state(false);
let value = $state('');
let errorMessage = $state('');
let pending = $state(false);

const isCreate = $derived(mode === 'create');
const title = $derived(isCreate ? 'New folder' : 'Rename');

export function show(initialValue = ''): void {
	value = initialValue;
	errorMessage = '';
	open = true;
}

const close = () => {
	open = false;
};

const submit = async () => {
	const normalizedValue = value.trim();
	if (
		INVALID_NAMES.has(normalizedValue) ||
		normalizedValue.includes(PATH_SEPARATOR)
	) {
		errorMessage = 'Use a single file or folder name without slashes';
		return;
	}
	pending = true;
	errorMessage = '';
	try {
		await onSubmit(normalizedValue);
		open = false;
	} catch {
		errorMessage = `${title} failed. Try again.`;
	} finally {
		pending = false;
	}
};
</script>

<ChipModal
	bind:open
	onsubmit={() => void submit()}
	dismissDisabled={pending}
	srTitle={title}
>
	<ChipModalHeader onClose={close} closeDisabled={pending}>
		{title}
	</ChipModalHeader>
	<ChipModalBody>
		<ChipModalField label="Name" for={inputId} error={errorMessage}>
			<ChipInput id={inputId} bind:value error={Boolean(errorMessage)} />
		</ChipModalField>
	</ChipModalBody>
	<ChipModalFooter onCancel={close} cancelDisabled={pending}>
		{#snippet primaryAction(
			initialFocus
		)}
			<ChipModalAction
				type="submit"
				variant="primary"
				disabled={pending || !value.trim()}
				{@attach initialFocus}
			>
				{#if pending}
					{isCreate ? 'Creating...' : 'Renaming...'}
				{:else}
					{isCreate ? 'Create' : 'Rename'}
				{/if}
			</ChipModalAction>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
