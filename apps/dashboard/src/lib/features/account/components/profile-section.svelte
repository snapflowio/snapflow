<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { Attachment } from 'svelte/attachments';

const PROFILE_NAME_MAX_LENGTH = 100;
const INITIALS_LENGTH = 2;

function initialsOf(name: string | undefined): string {
	return (name ?? '')
		.split(' ')
		.filter(Boolean)
		.map((part) => part[0])
		.join('')
		.toUpperCase()
		.slice(0, INITIALS_LENGTH);
}

const focusAndSelect: Attachment<HTMLInputElement> = (input) => {
	input.focus();
	input.select();
};
</script>

<script lang="ts">
import Check from '@lucide/svelte/icons/check';
import Pencil from '@lucide/svelte/icons/pencil';
import { updateProfileName } from '#lib/api/auth/account.ts';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import IconButton from '#lib/components/ui/icon-button.svelte';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';

const auth = getAuth();
let isEditingName = $state(false);
let profileName = $state('');
let saving = $state(false);
const initials = $derived(initialsOf(auth.user?.name));

function startNameEdit(): void {
	profileName = auth.user?.name ?? '';
	isEditingName = true;
}

function cancelNameEdit(): void {
	profileName = auth.user?.name ?? '';
	isEditingName = false;
}

async function saveName(name: string): Promise<void> {
	const result = await updateProfileName(name);
	if (result.error) {
		toast.error(result.error.message || 'Failed to update profile');
		profileName = auth.user?.name ?? '';
		return;
	}
	await auth.refetch();
	profileName = name;
	isEditingName = false;
	toast.success('Profile updated');
}

async function handleUpdateName(): Promise<void> {
	if (saving || !isEditingName) return;
	const name = profileName.trim();
	if (!name) {
		toast.error('Name is required');
		return;
	}
	if (name === auth.user?.name) {
		isEditingName = false;
		return;
	}
	saving = true;
	try {
		await saveName(name);
	} finally {
		saving = false;
	}
}

function handleNameKeydown(event: KeyboardEvent): void {
	if (event.key === 'Enter') {
		event.preventDefault();
		void handleUpdateName();
	}
	if (event.key === 'Escape') {
		event.preventDefault();
		cancelNameEdit();
	}
}
</script>

<SettingsSection title="Profile">
	<div class="flex flex-col gap-3">
		<div class="flex items-center gap-3">
			<div
				aria-hidden="true"
				class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border"
			>
				<span class="text-(--text-primary) text-base">{initials}</span>
			</div>
			<div class="flex min-w-0 flex-1 flex-col justify-center gap-px">
				<div class="flex min-w-0 items-center gap-2">
					{#if isEditingName}
						<div class="relative inline-flex min-w-0">
							<span
								class="invisible truncate whitespace-pre text-base"
								aria-hidden="true"
								>{profileName || ' '}</span
							>
							<input
								{@attach focusAndSelect}
								aria-label="Your name"
								bind:value={profileName}
								onkeydown={handleNameKeydown}
								onblur={() => void handleUpdateName()}
								class="absolute top-0 left-0 size-full border-0 bg-transparent p-0 text-base outline-hidden"
								maxlength={PROFILE_NAME_MAX_LENGTH}
								disabled={saving}
								autocomplete="off"
								spellcheck="false"
							>
						</div>
						<IconButton
							variant="ghost"
							class="size-3 shrink-0 p-0"
							onmousedown={(event) => event.preventDefault()}
							onclick={() => void handleUpdateName()}
							disabled={saving}
							label="Save name"
						>
							<Check class="size-3" />
						</IconButton>
					{:else}
						<h3 class="truncate text-base">{auth.user?.name || ''}</h3>
						<IconButton
							variant="ghost"
							class="size-2.75 shrink-0 p-0"
							onclick={startNameEdit}
							label="Edit name"
						>
							<Pencil class="size-2.75" />
						</IconButton>
					{/if}
				</div>
				<p class="truncate text-(--text-tertiary) text-sm">
					{auth.user?.email || ''}
				</p>
			</div>
		</div>
	</div>
</SettingsSection>
