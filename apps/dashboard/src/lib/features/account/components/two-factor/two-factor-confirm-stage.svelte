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
	pendingLabel: string;
}

const CONFIRM_COPY: Record<TwoFactorAction, ConfirmCopy> = {
	enable: {
		text: 'A new authenticator secret is generated for you to scan with your authenticator app.',
		label: 'Continue',
		pendingLabel: 'Generating...',
	},
	disable: {
		text: 'Disabling two-factor authentication removes your authenticator app. ',
		consequence: 'Administrator actions will need a passkey to verify you.',
		label: 'Disable',
		pendingLabel: 'Disabling...',
	},
	regenerate: {
		text: 'New recovery codes replace the current ones. ',
		consequence: 'Your existing recovery codes stop working immediately.',
		label: 'Regenerate',
		pendingLabel: 'Regenerating...',
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
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
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
	<p class="wrap-break-word px-2 text-(--text-primary) text-sm">
		{copy.text}
		{#if copy.consequence}
			<span class="text-(--text-error)">{copy.consequence}</span>
		{/if}
	</p>
	<ChipModalError message={errorMessage} />
</ChipModalBody>
<ChipModalFooter {onCancel} cancelDisabled={pending} defaultAction="dismiss">
	{#snippet primaryAction()}
		<ChipModalAction
			variant={action === 'disable' ? 'destructive' : 'primary'}
			disabled={pending}
			onclick={() => void confirm()}
		>
			{pending ? copy.pendingLabel : copy.label}
		</ChipModalAction>
	{/snippet}
</ChipModalFooter>
