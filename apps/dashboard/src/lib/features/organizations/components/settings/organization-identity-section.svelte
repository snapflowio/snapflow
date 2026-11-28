<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { AuthOrganization } from '#lib/api/auth/organization.ts';
import SettingsRow from '#lib/components/settings/settings-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import IdentityTile from '#lib/components/ui/avatar/identity-tile.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import {
	ORGANIZATION_NAME_MAX_LENGTH,
	ORGANIZATION_SLUG_MAX_LENGTH,
} from '#lib/features/organizations/lib/organization-slug.ts';
import type { OrganizationIdentityDraft } from '#lib/features/organizations/state/organization-identity-draft.svelte.ts';

interface OrganizationIdentitySectionProps {
	draft: OrganizationIdentityDraft;
	editable: boolean;
	saving: boolean;
	readOnlyReason?: string;
	organization: AuthOrganization;
}

let {
	draft,
	editable,
	saving,
	readOnlyReason,
	organization,
}: OrganizationIdentitySectionProps = $props();

const disabledReason = $derived(editable ? undefined : readOnlyReason);
</script>

<SettingsSection
	title="Identity"
	info={organization.personal
		? 'Personal organizations keep the name and slug of their owner.'
		: undefined}
>
	<SettingsRow label="Avatar">
		<IdentityTile name={organization.name} size="lg" />
	</SettingsRow>
	<SettingsRow
		layout="split"
		label="Name"
		error={draft.nameError}
		{disabledReason}
	>
		{#snippet control(id)}
			<ChipInput
				{id}
				bind:value={draft.name}
				maxlength={ORGANIZATION_NAME_MAX_LENGTH}
				autocomplete="off"
				error={Boolean(draft.nameError)}
				disabled={!editable || saving}
				class="w-full"
			/>
		{/snippet}
	</SettingsRow>
	<SettingsRow
		layout="split"
		label="Slug"
		description="Lowercase letters, numbers and dashes."
		error={draft.slugError}
		{disabledReason}
	>
		{#snippet control(id)}
			<ChipInput
				{id}
				bind:value={draft.slug}
				maxlength={ORGANIZATION_SLUG_MAX_LENGTH}
				autocomplete="off"
				spellcheck={false}
				error={Boolean(draft.slugError)}
				disabled={!editable || saving}
				class="w-full font-mono"
			/>
		{/snippet}
	</SettingsRow>
</SettingsSection>
