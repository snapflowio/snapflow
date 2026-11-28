<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
export type TwoFactorAction = 'enable' | 'disable' | 'regenerate';

interface ConfirmCopy {
	text: string;
	consequence?: string;
	label: string;
}

const CONFIRM_COPY: Record<TwoFactorAction, ConfirmCopy> = {
	enable: {
		text: 'You scan a new secret with your authenticator app.',
		label: 'Continue',
	},
	disable: {
		text: 'Your authenticator app is removed. ',
		consequence: 'Administrator actions will need a passkey to verify you.',
		label: 'Turn off',
	},
	regenerate: {
		text: 'New recovery codes replace the current ones. ',
		consequence: 'Your existing recovery codes stop working immediately.',
		label: 'Regenerate',
	},
};

interface TwoFactorConfirmStageProps {
	action: TwoFactorAction;
	errorMessage: string | null;
	onCancel: () => void;
	onConfirm: () => Promise<void>;
}
</script>

<script lang="ts">
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalError from '#lib/components/ui/chip-modal/chip-modal-error.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';

let { action, errorMessage, onCancel, onConfirm }: TwoFactorConfirmStageProps =
	$props();

let pending = $state(false);
const copy = $derived(CONFIRM_COPY[action]);

async function confirm(): Promise<void> {
	pending = true;
	try {
		await onConfirm();
	} finally {
		pending = false;
	}
}
</script>

<ChipModalBody>
	<p class="wrap-break-word text-(--text-primary) text-sm">
		{copy.text}
		{#if copy.consequence}
			<span class="text-(--text-error)">{copy.consequence}</span>
		{/if}
	</p>
	<ChipModalError message={errorMessage} />
</ChipModalBody>
<ChipModalFooter {onCancel} cancelDisabled={pending} defaultAction="dismiss">
	{#snippet primaryAction()}
		<Chip
			variant={action === 'disable' ? 'destructive' : 'primary'}
			loading={pending}
			onclick={() => void confirm()}
		>
			{copy.label}
		</Chip>
	{/snippet}
</ChipModalFooter>
