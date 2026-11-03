<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
export interface CredentialValue {
	label: string;
	value: string;
}

export interface CredentialDisplay {
	title: string;
	values: CredentialValue[];
}

interface CredentialsModalProps {
	credentials: CredentialDisplay | null;
	onClose: () => void;
}
</script>

<script lang="ts">
import ChipCopyInput from '#lib/components/ui/chip/chip-copy-input.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';

let { credentials, onClose }: CredentialsModalProps = $props();
</script>

<ChipModal
	open={Boolean(credentials)}
	onOpenChange={(open) => {
		if (!open) onClose();
	}}
	srTitle={credentials?.title ?? 'Credentials'}
>
	<ChipModalHeader>{credentials?.title}</ChipModalHeader>
	<ChipModalBody class="gap-3">
		<p class="text-caption text-(--text-muted)">
			Copy these values now. They cannot be shown again.
		</p>
		{#each credentials?.values ?? [] as credential (credential.label)}
			<div class="flex flex-col gap-1">
				<span class="text-caption text-(--text-muted)">
					{credential.label}
				</span>
				<ChipCopyInput
					value={credential.value}
					concealable
					copyLabel={`Copy ${credential.label}`}
				/>
			</div>
		{/each}
	</ChipModalBody>
	<ChipModalFooter defaultAction="dismiss" />
</ChipModal>
