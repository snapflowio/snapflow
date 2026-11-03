<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import EditRegistryForm, {
	type EditRegistryFormProps,
} from './edit-registry-form.svelte';

interface EditRegistryModalProps
	extends Omit<EditRegistryFormProps, 'onCancel'> {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

let {
	registry,
	open = $bindable(false),
	onOpenChange,
	onEditRegistry,
	loading = false,
}: EditRegistryModalProps = $props();

function close(): void {
	open = false;
	onOpenChange?.(false);
}
</script>

<ChipModal
	bind:open
	{onOpenChange}
	srTitle="Edit registry"
	dismissDisabled={loading}
>
	{#key registry}
		<EditRegistryForm {registry} {loading} {onEditRegistry} onCancel={close} />
	{/key}
</ChipModal>
