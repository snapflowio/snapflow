<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import SquareArrowUpRight from '@lucide/svelte/icons/square-arrow-up-right';
import { revalidateLogic } from '@tanstack/svelte-form';
import { showApiError } from '#lib/api/errors/show-api-error.ts';
import { requestSandboxPortAccess } from '#lib/api/sandboxes/exposure.ts';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import { formSubmitHandler } from '#lib/components/form/submit.ts';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import {
	DEFAULT_PREVIEW_PORT,
	MAX_TCP_PORT,
	MIN_TCP_PORT,
	previewSchema,
} from '#lib/features/sandboxes/lib/sandbox-port-preview.ts';
import { isSandboxInteractive } from '#lib/features/sandboxes/lib/sandbox-state.ts';
import { getSandboxDetail } from '#lib/features/sandboxes/state/sandbox-detail.svelte.ts';
import { openResolvedUrlInNewTab } from '#lib/utils/open-new-tab.ts';

const detail = getSandboxDetail();
const interactive = $derived(isSandboxInteractive(detail.sandbox));

const previewForm = createAppForm(() => ({
	defaultValues: { port: DEFAULT_PREVIEW_PORT },
	validationLogic: revalidateLogic(),
	validators: { onDynamic: previewSchema },
	onSubmit: ({ value }) =>
		openResolvedUrlInNewTab(
			async () => {
				const access = await requestSandboxPortAccess(
					detail.sandbox,
					Number(value.port)
				);
				return access.url;
			},
			(error) => showApiError(error, 'Failed to open port preview')
		),
}));
</script>

<SettingsSection title="Preview">
	<form
		class="flex items-end gap-2"
		novalidate
		onsubmit={formSubmitHandler(previewForm)}
	>
		<previewForm.AppField name="port">
			{#snippet children(
				field
			)}
				<field.TextField
					class="flex-1"
					label="Port"
					type="number"
					min={MIN_TCP_PORT}
					max={MAX_TCP_PORT}
				/>
			{/snippet}
		</previewForm.AppField>
		<previewForm.Subscribe
			selector={(state) => [state.canSubmit, state.isSubmitting] as const}
		>
			{#snippet children([canSubmit, isSubmitting])}
				<Chip
					type="submit"
					leftIcon={SquareArrowUpRight}
					disabled={!canSubmit ||
						isSubmitting ||
						!interactive ||
						!detail.canWrite}
				>
					Open preview
				</Chip>
			{/snippet}
		</previewForm.Subscribe>
	</form>
</SettingsSection>
