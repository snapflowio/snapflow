<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { ApiKeyListItem } from '#lib/api/organizations/api-keys.ts';
import { API_KEY_NAME_MAX_LENGTH } from '#lib/features/organizations/lib/api-key-permissions.ts';

interface RenameApiKeyModalProps {
	apiKey: ApiKeyListItem | null;
	onRename: (apiKey: ApiKeyListItem, name: string) => void;
	open?: boolean;
	pending: boolean;
}
</script>

<script lang="ts">
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';

let {
	apiKey,
	onRename,
	open = $bindable(false),
	pending,
}: RenameApiKeyModalProps = $props();

const inputId = $props.id();
let name = $derived(apiKey?.name ?? '');
const trimmed = $derived(name.trim());

function close(): void {
	open = false;
}

function submit(): void {
	if (!apiKey || pending || !trimmed || trimmed === apiKey.name) return;
	onRename(apiKey, trimmed);
}
</script>

<ChipModal
	bind:open
	onsubmit={submit}
	dismissDisabled={pending}
	srTitle="Rename API key"
>
	{#if apiKey}
		<ChipModalHeader onClose={close}>Rename API key</ChipModalHeader>
		<ChipModalBody>
			<ChipModalField label="Name" for={inputId} required>
				<ChipInput
					id={inputId}
					bind:value={name}
					maxlength={API_KEY_NAME_MAX_LENGTH}
					autocomplete="off"
				/>
			</ChipModalField>
		</ChipModalBody>
		<ChipModalFooter onCancel={close} cancelDisabled={pending}>
			{#snippet primaryAction()}
				<ChipModalAction
					type="submit"
					variant="primary"
					disabled={pending || !trimmed || trimmed === apiKey.name}
				>
					{pending ? 'Saving...' : 'Save'}
				</ChipModalAction>
			{/snippet}
		</ChipModalFooter>
	{/if}
</ChipModal>
