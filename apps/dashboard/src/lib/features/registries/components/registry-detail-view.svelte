<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import FeedbackState from '#lib/components/feedback-state.svelte';
import HexSimple from '#lib/components/icons/hex-simple.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import ChipCopyInput from '#lib/components/ui/chip/chip-copy-input.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipModalConfirmTarget from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';
import SecretInput from '#lib/components/ui/secret-input.svelte';
import { deleteRegistryCopy } from '#lib/features/registries/lib/registry-confirm-copy.ts';
import { REGISTRY_FIELDS } from '#lib/features/registries/lib/registry-detail.ts';
import { RegistryDetail } from '#lib/features/registries/state/registry-detail.svelte.ts';
import CredentialDetailHeading from '#lib/features/secrets/components/credential-detail-heading.svelte';
import CredentialDetailLayout from '#lib/features/secrets/components/credential-detail-layout.svelte';

let { registryId }: { registryId: string } = $props();

const id = $props.id();
const detail = new RegistryDetail(() => registryId);
const registry = $derived(detail.registry);
const draft = $derived(detail.draft);
</script>

<svelte:head>
	<title>{registry?.name ?? 'Registry'} · Snapflow</title>
</svelte:head>

{#if detail.query.isPending}
	<CredentialDetailLayout back={detail.back}>
		<FeedbackState message="Loading..." />
	</CredentialDetailLayout>
{:else if !(registry && draft)}
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
			icon={HexSimple}
			title={registry.name}
			subtitle={registry.url}
		/>
		<SettingsSection title="Registry ID">
			<ChipCopyInput value={registry.id} copyLabel="Copy ID" />
		</SettingsSection>
		{#each REGISTRY_FIELDS as field (field.key)}
			{const fieldError = $derived(detail.visibleErrors[field.key])}
			{const errorId = $derived(`${id}-${field.key}-error`)}
			<SettingsSection title={field.title}>
				<div class="flex flex-col gap-2">
					{#if field.secret}
						<SecretInput
							aria-label={field.title}
							value={draft[field.key]}
							onChange={(value) => detail.edit(field.key, value)}
							placeholder={field.placeholder}
							readonly={!detail.canWrite}
							error={Boolean(fieldError)}
						/>
					{:else}
						<ChipInput
							aria-label={field.title}
							value={draft[field.key]}
							oninput={(event) =>
								detail.edit(field.key, event.currentTarget.value)}
							placeholder={field.placeholder}
							readonly={!detail.canWrite}
							error={Boolean(fieldError)}
							aria-describedby={fieldError ? errorId : undefined}
							autocomplete="off"
						/>
					{/if}
					{#if fieldError}
						<p
							id={errorId}
							role="alert"
							class="text-(--text-error) text-caption"
						>
							{fieldError}
						</p>
					{/if}
				</div>
			</SettingsSection>
		{/each}
	</CredentialDetailLayout>
{/if}

<ChipModalConfirmTarget
	target={detail.deleteTarget}
	{...deleteRegistryCopy(registry ?? null)}
	pending={detail.deleteMutation.isPending}
	onCancel={detail.cancelDelete}
	onConfirm={detail.remove}
/>
