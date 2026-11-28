<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { createMutation } from '@tanstack/svelte-query';
import {
	removeCustomDomainMutationOptions,
	type SandboxCustomDomain,
} from '#lib/api/sandboxes/custom-domains.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';

interface RemoveCustomDomainModalProps {
	domain: SandboxCustomDomain | null;
	sandboxId: string;
	onClose: () => void;
}

let { domain, sandboxId, onClose }: RemoveCustomDomainModalProps = $props();

const remove = createMutation(() =>
	removeCustomDomainMutationOptions(sandboxId)
);

function submit(): void {
	if (domain) remove.mutate(domain, { onSuccess: onClose });
}
</script>

<ChipModalConfirm
	bind:open={
		() => domain !== null,
		(open) => {
	if (!open) onClose();
}
	}
	onsubmit={submit}
	title="Remove custom domain"
	text={[
		{ text: domain?.hostname ?? '', bold: true },
		' stops serving this sandbox immediately.',
	]}
	pending={remove.isPending}
>
	{#snippet confirm()}
		<Chip
			loading={remove.isPending}
			type="submit"
			variant="destructive"
			disabled={remove.isPending}
		>
			Remove
		</Chip>
	{/snippet}
</ChipModalConfirm>
