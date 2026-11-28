<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { createMutation } from '@tanstack/svelte-query';
import { accountExportMutationOptions } from '#lib/api/data-export.ts';
import { saveDiscardActions } from '#lib/components/page/header-actions.ts';
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import SettingsRow from '#lib/components/settings/settings-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import DeleteAccountSettings from '#lib/features/account/components/delete-account-settings.svelte';
import ProfileSection from '#lib/features/account/components/profile-section.svelte';
import { ProfileNameDraft } from '#lib/features/account/state/profile-name-draft.svelte.ts';

const exportData = createMutation(() => accountExportMutationOptions());
const draft = new ProfileNameDraft();
</script>

<SettingsPage
	title="Profile"
	dirty={draft.dirty}
	onDiscard={draft.discard}
	actions={saveDiscardActions({
		dirty: draft.dirty,
		saving: draft.saving,
		onSave: () => void draft.save(),
		onDiscard: draft.discard,
	})}
>
	<ProfileSection {draft} />
	<SettingsSection title="Data">
		<SettingsRow
			label="Download my data"
			description="A JSON file with your profile, memberships and activity."
		>
			<Chip
				variant="secondary"
				size="compact"
				loading={exportData.isPending}
				onclick={() => exportData.mutate()}
			>
				Download
			</Chip>
		</SettingsRow>
	</SettingsSection>
	<DeleteAccountSettings />
</SettingsPage>
