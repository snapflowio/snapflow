<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const UNVERIFIED_DESCRIPTION =
	'Verify your email to unlock higher limits and account recovery.';
</script>

<script lang="ts">
import SettingsRow from '#lib/components/settings/settings-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import IdentityTile from '#lib/components/ui/avatar/identity-tile.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import {
	PROFILE_NAME_MAX_LENGTH,
	type ProfileNameDraft,
} from '#lib/features/account/state/profile-name-draft.svelte.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';

let { draft }: { draft: ProfileNameDraft } = $props();

const auth = getAuth();
const displayName = $derived(auth.user?.name || auth.user?.email || '');
const verified = $derived(auth.user?.emailVerified === true);

function handleNameKeydown(event: KeyboardEvent): void {
	if (event.key !== 'Enter') return;
	event.preventDefault();
	void draft.save();
}
</script>

<SettingsSection title="Personal information">
	<SettingsRow label="Avatar">
		<IdentityTile name={displayName} size="lg" />
	</SettingsRow>
	<SettingsRow layout="split" label="Name" error={draft.error}>
		{#snippet control(id)}
			<ChipInput
				{id}
				bind:value={draft.name}
				onkeydown={handleNameKeydown}
				maxlength={PROFILE_NAME_MAX_LENGTH}
				autocomplete="name"
				spellcheck={false}
				error={Boolean(draft.error)}
				disabled={draft.saving}
				class="w-full"
			/>
		{/snippet}
	</SettingsRow>
	<SettingsRow layout="split" label="Email">
		<div class="flex min-w-0 items-center gap-3">
			<span class="truncate text-(--text-primary) text-sm">
				{auth.user?.email ?? ''}
			</span>
			<Badge
				size="sm"
				variant={verified ? 'success' : 'warning'}
				tooltip={verified ? undefined : UNVERIFIED_DESCRIPTION}
			>
				{verified ? 'Verified' : 'Not verified'}
			</Badge>
		</div>
	</SettingsRow>
</SettingsSection>
