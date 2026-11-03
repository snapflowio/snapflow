<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { formSubmitHandler } from '#lib/components/form/submit.ts';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import type { SandboxRecovery } from '#lib/features/sandboxes/state/sandbox-recovery.svelte.ts';

let { recovery }: { recovery: SandboxRecovery } = $props();

const form = $derived(recovery.form);
</script>

{#snippet namedActionSubmit()}
	<form.AppForm>
		<form.SubmitButton
			disabled={recovery.pending}
			pendingLabel={recovery.actionCopy.pendingLabel}
		>
			{recovery.actionCopy.label}
		</form.SubmitButton>
	</form.AppForm>
{/snippet}

<ChipModal
	bind:open={() => recovery.action !== null, recovery.changeNamedActionOpen}
	onsubmit={formSubmitHandler(form)}
	srTitle={recovery.actionCopy.title}
>
	<ChipModalHeader>{recovery.actionCopy.title}</ChipModalHeader>
	<ChipModalBody>
		<form.AppField name="name">
			{#snippet children(
				field
			)}
				<field.TextField
					label="Name"
					placeholder={recovery.action === 'fork'
						? `${recovery.sandbox.name}-fork`
						: `${recovery.sandbox.name}-snapshot`}
				/>
			{/snippet}
		</form.AppField>
	</ChipModalBody>
	<ChipModalFooter primaryAction={namedActionSubmit} />
</ChipModal>
