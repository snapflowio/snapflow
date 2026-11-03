<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import SecretReveal from './settings/secret-reveal.svelte';

interface ApiKeyCreatedModalProps {
	secret: string | null;
	onClose: () => void;
}

let { secret, onClose }: ApiKeyCreatedModalProps = $props();
</script>

<ChipModal
	open={secret !== null}
	onOpenChange={(open) => {
		if (!open) onClose();
	}}
	srTitle="Your API key has been created"
>
	<ChipModalHeader {onClose}>Your API key has been created</ChipModalHeader>
	<ChipModalBody>
		<ChipModalField label="Copy it now — it won't be shown again">
			<SecretReveal value={secret ?? undefined} />
		</ChipModalField>
	</ChipModalBody>
	<ChipModalFooter onCancel={onClose}>
		{#snippet primaryAction()}
			<Chip variant="primary" onclick={onClose}>Done</Chip>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
