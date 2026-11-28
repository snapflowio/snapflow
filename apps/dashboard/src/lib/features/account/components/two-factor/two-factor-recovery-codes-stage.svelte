<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Check from '@lucide/svelte/icons/check';
import Copy from '@lucide/svelte/icons/copy';
import Chip from '#lib/components/ui/chip/chip.svelte';
import { chipFieldSurfaceClass } from '#lib/components/ui/chip/chip-chrome.ts';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import { CopyToClipboard } from '#lib/components/ui/clipboard/copy-to-clipboard.svelte.ts';
import { cn } from '#lib/utils/utils.ts';

const CODE_SEPARATOR = '\n';

interface TwoFactorRecoveryCodesStageProps {
	codes: readonly string[];
	onDone: () => void;
}

let { codes, onDone }: TwoFactorRecoveryCodesStageProps = $props();

const clipboard = new CopyToClipboard();
</script>

{#snippet copyAll()}
	<Chip
		leftIcon={clipboard.copied ? Check : Copy}
		onclick={() => void clipboard.copy(codes.join(CODE_SEPARATOR))}
	>
		{clipboard.label('Copy all')}
	</Chip>
{/snippet}

<ChipModalBody>
	<ChipModalField
		label="Copy these now. You won't see them again."
		hint="Each code signs you in once if you lose your authenticator app."
	>
		<div
			class={cn('grid grid-cols-2 gap-x-6 gap-y-2 p-4', chipFieldSurfaceClass)}
		>
			{#each codes as code (code)}
				<code class="font-mono text-(--text-body) text-sm">{code}</code>
			{/each}
		</div>
	</ChipModalField>
</ChipModalBody>
<ChipModalFooter onCancel={onDone} hideCancel leadingContent={copyAll}>
	{#snippet primaryAction(initialFocus)}
		<Chip variant="primary" onclick={onDone} {@attach initialFocus}>
			Done
		</Chip>
	{/snippet}
</ChipModalFooter>
