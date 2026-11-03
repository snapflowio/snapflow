<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { SandboxListItem } from '@snapflow/api-client';
import type { SandboxBulkAction } from '#lib/api/sandboxes/sandboxes.ts';

export interface SandboxActionRequest {
	action: SandboxBulkAction;
	targets: readonly SandboxListItem[];
}

interface SandboxActionConfirmModalProps {
	request: SandboxActionRequest | null;
	pending: boolean;
	onClose: () => void;
	onConfirm: (request: SandboxActionRequest) => void;
}
</script>

<script lang="ts">
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import {
	SANDBOX_ACTION_COPY,
	sandboxCountLabel,
} from '#lib/features/sandboxes/lib/sandbox-list-actions.ts';

let { request, pending, onClose, onConfirm }: SandboxActionConfirmModalProps =
	$props();

const copy = $derived(request ? SANDBOX_ACTION_COPY[request.action] : null);
const count = $derived(request?.targets.length ?? 0);
const subject = $derived(
	count === 1
		? (request?.targets[0]?.name ?? 'this sandbox')
		: sandboxCountLabel(count)
);
const isDelete = $derived(request?.action === 'delete');
const title = $derived(
	copy ? `${copy.label} ${count === 1 ? 'sandbox' : 'sandboxes'}` : ''
);
const text = $derived(
	isDelete
		? [
				'Are you sure you want to delete ',
				{ text: subject, bold: true },
				'? ',
				{
					text:
						count === 1 ? 'It will be destroyed.' : 'They will be destroyed.',
					error: true,
				},
				' Accounting and audit evidence is retained.',
			]
		: [
				`${copy?.label ?? ''} `,
				{ text: subject, bold: true },
				'?',
				count > 1
					? ' Selected sandboxes that cannot change are left as is.'
					: '',
			]
);
</script>

<ChipModalConfirm
	bind:open={
		() => request !== null,
		(open) => {
	if (!open) onClose();
}
	}
	onsubmit={() => {
		if (request) onConfirm(request);
	}}
	{title}
	{text}
	{pending}
>
	{#snippet confirm()}
		<ChipModalAction
			type="submit"
			variant={isDelete ? 'destructive' : 'primary'}
			disabled={pending || count === 0}
		>
			{pending ? copy?.pendingLabel : copy?.label}
		</ChipModalAction>
	{/snippet}
</ChipModalConfirm>
