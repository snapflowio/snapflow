<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Copy from '@lucide/svelte/icons/copy';
import Chip from '#lib/components/ui/chip/chip.svelte';
import { chipFieldSurfaceClass } from '#lib/components/ui/chip/chip-chrome.ts';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { cn } from '#lib/utils/utils.ts';

interface TwoFactorRecoveryCodesStageProps {
	codes: readonly string[];
	onDone: () => void;
}

let { codes, onDone }: TwoFactorRecoveryCodesStageProps = $props();

async function copyCodes(): Promise<void> {
	try {
		await navigator.clipboard.writeText(codes.join('\n'));
		toast.success('Recovery codes copied');
	} catch {
		toast.error('Could not copy recovery codes');
	}
}
</script>

{#snippet copyAll()}
	<Chip leftIcon={Copy} onclick={() => void copyCodes()}>Copy all</Chip>
{/snippet}

<ChipModalBody>
	<ChipModalField
		label="Copy them now — they won't be shown again"
		hint="Each code signs you in once if you lose your authenticator app."
	>
		<div
			class={cn(
				'grid grid-cols-2 gap-x-4 gap-y-1.5 px-2 py-2',
				chipFieldSurfaceClass
			)}
		>
			{#each codes as code (code)}
				<code class="font-mono text-(--text-body) text-small">{code}</code>
			{/each}
		</div>
	</ChipModalField>
</ChipModalBody>
<ChipModalFooter onCancel={onDone} hideCancel leadingContent={copyAll}>
	{#snippet primaryAction(
		initialFocus
	)}
		<ChipModalAction variant="primary" onclick={onDone} {@attach initialFocus}>
			Done
		</ChipModalAction>
	{/snippet}
</ChipModalFooter>
