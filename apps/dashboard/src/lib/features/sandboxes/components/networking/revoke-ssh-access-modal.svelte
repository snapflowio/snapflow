<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { SshAccessGrantDto } from '@snapflow/api-client';

export const REVOKE_ALL_SSH_ACCESS = 'all';

export type SshAccessRevokeTarget =
	| SshAccessGrantDto
	| typeof REVOKE_ALL_SSH_ACCESS;

interface RevokeSshAccessModalProps {
	target: SshAccessRevokeTarget | null;
	sandboxId: string;
	onClose: () => void;
}
</script>

<script lang="ts">
import { createMutation } from '@tanstack/svelte-query';
import {
	revokeSshAccessGrantMutationOptions,
	revokeSshAccessMutationOptions,
} from '#lib/api/sandboxes/sandboxes.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import { formatDateTime } from '#lib/utils/format.ts';

let { target, sandboxId, onClose }: RevokeSshAccessModalProps = $props();

const revokeAll = createMutation(() =>
	revokeSshAccessMutationOptions(sandboxId)
);
const revokeGrant = createMutation(() =>
	revokeSshAccessGrantMutationOptions(sandboxId)
);
const pending = $derived(revokeAll.isPending || revokeGrant.isPending);
const text = $derived(
	target === REVOKE_ALL_SSH_ACCESS
		? 'Every active SSH command for this sandbox stops working immediately.'
		: [
				'The SSH command that expires ',
				{ text: target ? formatDateTime(target.expiresAt) : '', bold: true },
				' stops working immediately.',
			]
);

function revoke(): void {
	if (target === null) return;
	const path = { sandboxIdOrName: sandboxId };
	if (target === REVOKE_ALL_SSH_ACCESS) {
		revokeAll.mutate({ path }, { onSuccess: onClose });
		return;
	}
	revokeGrant.mutate(
		{ path: { ...path, accessId: target.id } },
		{ onSuccess: onClose }
	);
}
</script>

<ChipModalConfirm
	bind:open={
		() => target !== null,
		(open) => {
	if (!open) onClose();
}
	}
	onsubmit={revoke}
	title={target === REVOKE_ALL_SSH_ACCESS
		? 'Revoke all SSH access'
		: 'Revoke SSH access'}
	{text}
	{pending}
>
	{#snippet confirm()}
		<Chip
			loading={pending}
			type="submit"
			variant="destructive"
			disabled={pending}
		>
			Revoke
		</Chip>
	{/snippet}
</ChipModalConfirm>
