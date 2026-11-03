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
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import {
	type ConfigurationMode,
	configurationModalTitle,
} from '#lib/features/sandboxes/lib/sandbox-configuration.ts';
import { getSandboxDetail } from '#lib/features/sandboxes/state/sandbox-detail.svelte.ts';
import SandboxConfigurationForm from './sandbox-configuration-form.svelte';

interface SandboxConfigurationModalProps {
	mode: ConfigurationMode | null;
	openCount: number;
}

let { mode = $bindable(null), openCount }: SandboxConfigurationModalProps =
	$props();

const detail = getSandboxDetail();
const title = $derived(configurationModalTitle(mode));

function close() {
	mode = null;
}
</script>

<ChipModal
	bind:open={
		() => mode !== null,
		(open) => {
	if (!open) close();
}
	}
	srTitle={title}
>
	<ChipModalHeader>{title}</ChipModalHeader>
	{#key openCount}
		{#key detail.sandbox}
			<SandboxConfigurationForm {mode} onSaved={close} />
		{/key}
	{/key}
</ChipModal>
