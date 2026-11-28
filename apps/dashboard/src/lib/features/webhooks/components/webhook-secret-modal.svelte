<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { WebhookEndpointActions } from '#lib/features/webhooks/state/webhook-endpoint-actions.svelte.ts';

const COPY_FIRST_REASON = 'Copy the secret first';
const PREVIOUS_SECRET_GRACE =
	'The previous secret keeps signing deliveries for 24 hours.';

interface WebhookSecretModalProps {
	actions: WebhookEndpointActions;
}
</script>

<script lang="ts">
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import SecretReveal from '#lib/components/ui/clipboard/secret-reveal.svelte';

let { actions }: WebhookSecretModalProps = $props();

let copied = $state(false);

const revealed = $derived(actions.revealed);
const rotating = $derived(actions.rotating);
const open = $derived(revealed !== null || rotating !== null);
const pending = $derived(actions.rotateMutation.isPending);
const title = $derived.by(() => {
	if (revealed === null) return 'Rotate signing secret';
	return revealed.rotated ? 'New signing secret' : 'Endpoint added';
});

function close(): void {
	if (pending || (revealed !== null && !copied)) return;
	copied = false;
	actions.closeSecret();
}

function confirmRotate(): void {
	if (rotating) actions.rotate(rotating);
}
</script>

<ChipModal
	{open}
	onOpenChange={(next) => {
		if (!next) close();
	}}
	onsubmit={revealed === null ? confirmRotate : undefined}
	dismissDisabled={pending || (revealed !== null && !copied)}
	size={revealed === null ? 'sm' : 'md'}
	srTitle={title}
>
	<ChipModalHeader
		onClose={revealed === null || copied ? close : undefined}
		closeDisabled={pending}
	>
		{title}
	</ChipModalHeader>
	{#if revealed === null}
		<ChipModalBody>
			<p class="wrap-break-word text-(--text-primary) text-sm">
				A new secret signs deliveries to
				<strong class="font-medium">{rotating?.url}</strong>.
				{PREVIOUS_SECRET_GRACE}
			</p>
		</ChipModalBody>
		<ChipModalFooter defaultAction="dismiss" cancelDisabled={pending}>
			{#snippet primaryAction()}
				<Chip type="submit" variant="primary" loading={pending}>Rotate</Chip>
			{/snippet}
		</ChipModalFooter>
	{:else}
		<ChipModalBody>
			<SecretReveal value={revealed.secret} onCopied={() => (copied = true)} />
			<p class="text-(--text-muted) text-xs">
				Verify the webhook-signature header with any Standard Webhooks library.
				{#if revealed.rotated}
					{PREVIOUS_SECRET_GRACE}
				{/if}
			</p>
		</ChipModalBody>
		<ChipModalFooter hideCancel>
			{#snippet primaryAction()}
				<Chip
					variant="primary"
					disabledReason={copied ? undefined : COPY_FIRST_REASON}
					onclick={close}
				>
					Done
				</Chip>
			{/snippet}
		</ChipModalFooter>
	{/if}
</ChipModal>
