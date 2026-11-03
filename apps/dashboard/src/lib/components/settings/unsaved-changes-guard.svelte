<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import { beforeNavigate, goto } from '$app/navigation';

interface UnsavedChangesGuardProps {
	dirty: boolean;
	onDiscard?: () => void;
}

let { dirty, onDiscard }: UnsavedChangesGuardProps = $props();

let open = $state(false);
let pendingUrl: URL | null = null;
let bypass = false;

beforeNavigate((navigation) => {
	if (!dirty || bypass) return;
	if (navigation.type === 'leave') {
		navigation.cancel();
		return;
	}
	if (!navigation.to) return;
	navigation.cancel();
	pendingUrl = navigation.to.url;
	open = true;
});

async function discard(): Promise<void> {
	const target = pendingUrl;
	open = false;
	pendingUrl = null;
	onDiscard?.();
	if (!target) return;
	bypass = true;
	try {
		await goto(target);
	} finally {
		bypass = false;
	}
}
</script>

{#snippet confirm()}
	<Chip variant="primary" onclick={() => void discard()}>Discard changes</Chip>
{/snippet}

<ChipModalConfirm
	bind:open
	title="Unsaved changes"
	text="You have unsaved changes. Are you sure you want to discard them?"
	cancelLabel="Keep editing"
	{confirm}
/>
