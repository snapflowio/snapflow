<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const DESCRIPTION_ROWS = 4;
</script>

<script lang="ts">
import Key from '@lucide/svelte/icons/key';
import FeedbackState from '#lib/components/feedback-state.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import ChipCopyInput from '#lib/components/ui/chip/chip-copy-input.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipTextarea from '#lib/components/ui/chip/chip-textarea.svelte';
import ChipModalConfirmTarget from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';
import CredentialDetailHeading from '#lib/features/secrets/components/credential-detail-heading.svelte';
import CredentialDetailLayout from '#lib/features/secrets/components/credential-detail-layout.svelte';
import SecretValueField from '#lib/features/secrets/components/secret-value-field.svelte';
import { deleteSecretCopy } from '#lib/features/secrets/lib/secret-confirm-copy.ts';
import { SecretDetail } from '#lib/features/secrets/state/secret-detail.svelte.ts';

let { secretId }: { secretId: string } = $props();

const id = $props.id();
const detail = new SecretDetail(() => secretId);
const secret = $derived(detail.secret);
</script>

<svelte:head>
	<title>{secret?.name ?? 'Secret'} · Snapflow</title>
</svelte:head>

{#if detail.query.isPending}
	<CredentialDetailLayout back={detail.back}>
		<FeedbackState message="Loading..." />
	</CredentialDetailLayout>
{:else if !secret}
	<CredentialDetailLayout back={detail.back}>
		<FeedbackState message={detail.loadErrorMessage} />
	</CredentialDetailLayout>
{:else}
	<CredentialDetailLayout
		back={detail.back}
		actions={detail.actions}
		dirty={detail.dirty}
		onDiscard={detail.discard}
	>
		<CredentialDetailHeading
			icon={Key}
			title={secret.name}
			subtitle={`Version ${secret.currentVersion}`}
		/>
		<SettingsSection title="Secret ID">
			<ChipCopyInput value={secret.id} copyLabel="Copy ID" />
		</SettingsSection>
		<SettingsSection title="Name">
			<div class="flex flex-col gap-2">
				<ChipInput
					id={`${id}-name`}
					aria-label="Name"
					value={detail.name}
					oninput={(event) => (detail.nameDraft = event.currentTarget.value)}
					readonly={!detail.canWrite}
					error={Boolean(detail.nameError)}
					aria-describedby={detail.nameError ? `${id}-name-error` : undefined}
					autocomplete="off"
				/>
				{#if detail.nameError}
					<p
						id={`${id}-name-error`}
						role="alert"
						class="text-(--text-error) text-caption"
					>
						{detail.nameError}
					</p>
				{/if}
			</div>
		</SettingsSection>
		{#if detail.canWrite}
			<SettingsSection
				title="Value"
				description="Values are write-only. Saving a new value creates a new version."
			>
				<SecretValueField
					aria-label="New value"
					bind:value={detail.valueDraft}
					placeholder="Enter a new value"
				/>
			</SettingsSection>
		{/if}
		<SettingsSection title="Description">
			<ChipTextarea
				aria-label="Description"
				rows={DESCRIPTION_ROWS}
				value={detail.description}
				oninput={(event) =>
					(detail.descriptionDraft = event.currentTarget.value)}
				placeholder="Add a description..."
				readonly={!detail.canWrite}
				autocomplete="off"
			/>
		</SettingsSection>
	</CredentialDetailLayout>
{/if}

<ChipModalConfirmTarget
	target={detail.deleteTarget}
	{...deleteSecretCopy(secret ?? null)}
	pending={detail.deleteMutation.isPending}
	onCancel={detail.cancelDelete}
	onConfirm={detail.remove}
/>
