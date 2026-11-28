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
}
</script>

<script lang="ts" generics="TTarget">
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalConfirm, {
	type ChipConfirmFriction,
} from './chip-modal-confirm.svelte';

interface ChipModalConfirmTargetProps extends ChipConfirmCopy {
	target: TTarget | null;
	pending: boolean;
	destructive?: boolean;
	friction?: ChipConfirmFriction;
	confirmName?: string;
	error?: string | null;
	onCancel: () => void;
	onConfirm: (target: TTarget) => void;
}

let {
	target,
	title,
	text,
	confirmLabel,
	pending,
	destructive = true,
	friction = 'none',
	confirmName,
	error: errorMessage,
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
	{friction}
	{confirmName}
	error={errorMessage}
>
	{#snippet confirm(ready)}
		<Chip
			type="submit"
			variant={destructive ? 'destructive' : 'primary'}
			loading={pending}
			disabled={!ready}
		>
			{confirmLabel}
		</Chip>
	{/snippet}
</ChipModalConfirm>
