<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { ChipConfirmText } from './chip-modal-confirm.svelte';

export interface ChipConfirmCopy {
	title: string;
	text: ChipConfirmText;
	confirmLabel: string;
	pendingLabel: string;
}
</script>

<script lang="ts" generics="TTarget">
import ChipModalAction from './chip-modal-action.svelte';
import ChipModalConfirm from './chip-modal-confirm.svelte';

interface ChipModalConfirmTargetProps extends ChipConfirmCopy {
	target: TTarget | null;
	pending: boolean;
	destructive?: boolean;
	onCancel: () => void;
	onConfirm: (target: TTarget) => void;
}

let {
	target,
	title,
	text,
	confirmLabel,
	pendingLabel,
	pending,
	destructive = true,
	onCancel,
	onConfirm,
}: ChipModalConfirmTargetProps = $props();
</script>

<ChipModalConfirm
	open={target !== null}
	onOpenChange={(open) => {
		if (!open) onCancel();
	}}
	onsubmit={() => {
		if (target !== null) onConfirm(target);
	}}
	{title}
	{text}
	{pending}
>
	{#snippet confirm()}
		<ChipModalAction
			type="submit"
			variant={destructive ? 'destructive' : 'primary'}
			disabled={pending}
		>
			{pending ? pendingLabel : confirmLabel}
		</ChipModalAction>
	{/snippet}
</ChipModalConfirm>
