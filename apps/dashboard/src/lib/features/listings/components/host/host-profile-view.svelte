<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Eye from '@lucide/svelte/icons/eye';
import FeedbackState from '#lib/components/feedback-state.svelte';
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import SettingsRow from '#lib/components/settings/settings-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipTextarea from '#lib/components/ui/chip/chip-textarea.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import Skeleton, {
	SKELETON_SECTION_ROWS,
} from '#lib/components/ui/skeleton/skeleton.svelte';
import HostProfileCard from '#lib/features/listings/components/host/host-profile-card.svelte';
import { HOST_PROFILE_LIMITS } from '#lib/features/listings/lib/host-profile.ts';
import { HostProfileEditor } from '#lib/features/listings/state/host-profile-editor.svelte.ts';

const editor = new HostProfileEditor();
const disabled = $derived(!editor.canWrite || editor.saving);
const writeReason = $derived(
	editor.canWrite ? undefined : 'Ask a member who manages listings'
);
let previewing = $state(false);
const previewAction: HeaderAction = $derived({
	id: 'preview',
	kind: 'secondary',
	label: 'Preview',
	icon: Eye,
	onSelect: () => (previewing = true),
	disabled: editor.query.data === undefined,
});
</script>

<SettingsPage
	title="Host profile"
	description="What renters see about you on your marketplace listings."
	actions={[previewAction, ...editor.actions]}
	dirty={editor.dirty}
	onDiscard={editor.discard}
>
	{#if editor.query.data}
		{const profile = $derived(editor.query.data)}
		<SettingsSection title="Profile">
			<SettingsRow
				label="Display name"
				description="The name renters see on your listings."
				layout="split"
				error={editor.errors.displayName}
				disabledReason={writeReason}
			>
				{#snippet control(id)}
					<ChipInput
						{id}
						bind:value={
							() => editor.values.displayName,
							(displayName) => editor.edit('displayName', displayName)
						}
						maxlength={HOST_PROFILE_LIMITS.DISPLAY_NAME_MAX_LENGTH}
						autocomplete="off"
						aria-invalid={editor.errors.displayName ? true : undefined}
						error={Boolean(editor.errors.displayName)}
						{disabled}
					/>
				{/snippet}
			</SettingsRow>
			<SettingsRow
				label="Description"
				description="A short note about you and your machines. Empty shows none."
				layout="split"
				error={editor.errors.description}
				disabledReason={writeReason}
			>
				{#snippet control(id)}
					<ChipTextarea
						{id}
						bind:value={
							() => editor.values.description,
							(description) => editor.edit('description', description)
						}
						maxlength={HOST_PROFILE_LIMITS.DESCRIPTION_MAX_LENGTH}
						error={Boolean(editor.errors.description)}
						{disabled}
					/>
				{/snippet}
			</SettingsRow>
		</SettingsSection>
		<ChipModal bind:open={previewing} srTitle="Host profile preview">
			<ChipModalHeader onClose={() => (previewing = false)}>
				Host profile preview
			</ChipModalHeader>
			<ChipModalBody>
				<HostProfileCard
					displayName={editor.values.displayName.trim() || profile.displayName}
					description={editor.values.description.trim() || null}
					stats={profile.stats}
				/>
			</ChipModalBody>
			<ChipModalFooter
				onCancel={() => (previewing = false)}
				cancelLabel="Done"
				defaultAction="dismiss"
			/>
		</ChipModal>
	{:else if editor.query.isError}
		<FeedbackState
			variant="inline"
			tone="error"
			resource="the host profile"
			error={editor.query.error}
			retrying={editor.query.isFetching}
			onRetry={() => void editor.query.refetch()}
		/>
	{:else}
		<Skeleton class="h-9" repeat={SKELETON_SECTION_ROWS} fade />
	{/if}
</SettingsPage>
