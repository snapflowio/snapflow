<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { useQueryClient } from '@tanstack/svelte-query';
import { reauthentication } from '#lib/api/auth/reauthentication.svelte.ts';
import { signOut } from '#lib/api/auth/session.ts';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalError from '#lib/components/ui/chip-modal/chip-modal-error.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';

const queryClient = useQueryClient();
let errorMessage = $state<string | null>(null);
let pending = $state(false);

async function signInAgain() {
	errorMessage = null;
	pending = true;
	try {
		await signOut(queryClient);
		reauthentication.dismiss();
	} catch (signOutError) {
		errorMessage = SnapflowError.fromUnknown(signOutError).message;
	} finally {
		pending = false;
	}
}
</script>

<ChipModal
	open
	onOpenChange={(nextOpen) => !nextOpen && reauthentication.dismiss()}
	size="sm"
	srTitle="Sign in again"
	dismissDisabled={pending}
>
	<ChipModalHeader onClose={reauthentication.dismiss}>
		Sign in again
	</ChipModalHeader>
	<ChipModalBody>
		<p class="px-2 text-(--text-secondary) text-sm">
			This action needs a recent sign-in. Sign in again, then retry it.
		</p>
		<ChipModalError message={errorMessage} />
	</ChipModalBody>
	<ChipModalFooter onCancel={reauthentication.dismiss} cancelDisabled={pending}>
		{#snippet primaryAction(
			initialFocus
		)}
			<ChipModalAction
				variant="primary"
				disabled={pending}
				onclick={() => void signInAgain()}
				{@attach initialFocus}
			>
				{pending ? 'Signing out...' : 'Sign in again'}
			</ChipModalAction>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
