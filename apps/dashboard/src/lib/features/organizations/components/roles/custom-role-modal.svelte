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
import CustomRoleForm, {
	type CustomRoleFormProps,
} from './custom-role-form.svelte';

interface CustomRoleModalProps
	extends Omit<CustomRoleFormProps, 'onClose' | 'title'> {
	open?: boolean;
}

let { open = $bindable(false), ...formProps }: CustomRoleModalProps = $props();

const title = $derived(formProps.role ? 'Edit role' : 'Create role');
</script>

<ChipModal bind:open size="lg" srTitle={title}>
	{#if open}
		<CustomRoleForm {...formProps} {title} onClose={() => (open = false)} />
	{/if}
</ChipModal>
