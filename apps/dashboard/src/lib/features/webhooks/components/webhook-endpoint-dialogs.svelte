<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ChipModalConfirmTarget from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';
import WebhookEndpointFormModal from '#lib/features/webhooks/components/webhook-endpoint-form-modal.svelte';
import WebhookSecretModal from '#lib/features/webhooks/components/webhook-secret-modal.svelte';
import { deleteEndpointCopy } from '#lib/features/webhooks/lib/webhook-display.ts';
import type { WebhookEndpointActions } from '#lib/features/webhooks/state/webhook-endpoint-actions.svelte.ts';

let { actions }: { actions: WebhookEndpointActions } = $props();
</script>

<WebhookEndpointFormModal
	open={actions.formOpen}
	endpoint={actions.editing}
	onOpenChange={actions.changeFormOpen}
	onSubmit={actions.submit}
/>
<WebhookSecretModal {actions} />
<ChipModalConfirmTarget
	target={actions.deleting}
	{...deleteEndpointCopy(actions.deleting)}
	pending={actions.deleteMutation.isPending}
	onCancel={() => (actions.deleting = null)}
	onConfirm={actions.remove}
/>
