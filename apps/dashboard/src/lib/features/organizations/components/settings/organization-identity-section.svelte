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
import SettingsField from '#lib/components/settings/settings-field.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import ChipCopyInput from '#lib/components/ui/chip/chip-copy-input.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import {
	ORGANIZATION_NAME_MAX_LENGTH,
	ORGANIZATION_SLUG_MAX_LENGTH,
} from '#lib/features/organizations/lib/organization-slug.ts';
import type { OrganizationIdentityDraft } from '#lib/features/organizations/state/organization-identity-draft.svelte.ts';
import { formatDate } from '#lib/utils/format.ts';

interface OrganizationIdentitySectionProps {
	draft: OrganizationIdentityDraft;
	editable: boolean;
	organization: AuthOrganization;
	saving: boolean;
}

let {
	draft,
	editable,
	organization,
	saving,
}: OrganizationIdentitySectionProps = $props();

const nameId = $props.id();
const slugId = `${nameId}-slug`;
</script>

{#snippet fieldError(
	id: string,
	message: string | undefined
)}
	{#if message}
		<p {id} role="alert" class="mt-2 pl-0.5 text-(--text-error) text-caption">
			{message}
		</p>
	{/if}
{/snippet}

<SettingsSection title="Organization ID">
	<ChipCopyInput
		value={organization.id}
		copyLabel="Copy organization ID"
		class="font-mono"
		aria-label="Organization ID"
	/>
</SettingsSection>

<SettingsSection title="Name">
	<ChipInput
		id={nameId}
		bind:value={draft.name}
		maxlength={ORGANIZATION_NAME_MAX_LENGTH}
		autocomplete="off"
		aria-label="Name"
		aria-invalid={draft.nameError ? true : undefined}
		aria-describedby={draft.nameError ? `${nameId}-error` : undefined}
		error={Boolean(draft.nameError)}
		disabled={!editable || saving}
	/>
	{@render fieldError(`${nameId}-error`, draft.nameError)}
</SettingsSection>

<SettingsSection title="Slug">
	<ChipInput
		id={slugId}
		bind:value={draft.slug}
		maxlength={ORGANIZATION_SLUG_MAX_LENGTH}
		autocomplete="off"
		aria-label="Slug"
		aria-invalid={draft.slugError ? true : undefined}
		aria-describedby={draft.slugError ? `${slugId}-error` : undefined}
		error={Boolean(draft.slugError)}
		disabled={!editable || saving}
	/>
	{@render fieldError(`${slugId}-error`, draft.slugError)}
</SettingsSection>

<SettingsSection title="Details">
	<div class="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
		<SettingsField
			label="Type"
			value={organization.personal ? 'Personal' : 'Team'}
		/>
		<SettingsField label="Created" value={formatDate(organization.createdAt)} />
	</div>
</SettingsSection>
