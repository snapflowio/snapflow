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
import ApiKeyCreatedModal from '#lib/features/organizations/components/api-key-created-modal.svelte';
import CreateApiKeyModal from '#lib/features/organizations/components/create-api-key-modal.svelte';
import RenameApiKeyModal from '#lib/features/organizations/components/rename-api-key-modal.svelte';
import { deleteApiKeyCopy } from '#lib/features/organizations/lib/api-keys-page.ts';
import type { ApiKeysPage } from '#lib/features/organizations/state/api-keys-page.svelte.ts';

let { page }: { page: ApiKeysPage } = $props();
</script>

<CreateApiKeyModal
	bind:open={page.createOpen}
	scopeOptions={page.scopeOptions}
	onCreate={page.createKey}
/>
<ApiKeyCreatedModal
	secret={page.createdSecret}
	onClose={() => (page.createdSecret = null)}
/>
<RenameApiKeyModal
	bind:open={() => page.renaming !== null, page.closeRename}
	apiKey={page.renaming}
	onRename={(apiKey, name) => page.saveChange({ apiKey, name })}
	pending={page.updateMutation.isPending}
/>
<ChipModalConfirmTarget
	target={page.deleting}
	{...deleteApiKeyCopy(page.deleting)}
	pending={page.removeMutation.isPending}
	onCancel={() => (page.deleting = null)}
	onConfirm={page.deleteKey}
/>
