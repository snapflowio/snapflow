<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type {
	DockerRegistry,
	UpdateDockerRegistry,
} from '@snapflow/api-client';
import * as z from 'zod';
import { registryUrlSchema } from '#lib/features/registries/lib/registry-validation.ts';

const schema = z.object({
	name: z.string().min(1, 'Name is required'),
	url: registryUrlSchema,
	username: z.string().min(1, 'Username is required'),
	password: z.string(),
	project: z.string(),
});

type EditRegistryValues = z.infer<typeof schema>;
type EditableRegistry = Pick<
	DockerRegistry,
	'name' | 'project' | 'url' | 'username'
>;

const TEXT_FIELDS = [
	['name', 'Name', 'production-registry'],
	['url', 'URL', 'docker.io'],
	['username', 'Username', 'myusername'],
] as const;

function registryValues(registry: EditableRegistry | null): EditRegistryValues {
	return {
		name: registry?.name ?? '',
		url: registry?.url ?? '',
		username: registry?.username ?? '',
		password: '',
		project: registry?.project || '',
	};
}

export interface EditRegistryFormProps {
	registry: EditableRegistry | null;
	onCancel: () => void;
	onEditRegistry: (data: UpdateDockerRegistry) => Promise<void>;
	loading?: boolean;
}
</script>

<script lang="ts">
import { revalidateLogic } from '@tanstack/svelte-form';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import { formSubmitHandler } from '#lib/components/form/submit.ts';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';

let {
	registry,
	onCancel,
	onEditRegistry,
	loading = false,
}: EditRegistryFormProps = $props();

const form = createAppForm(() => ({
	defaultValues: registryValues(registry),
	validationLogic: revalidateLogic(),
	validators: { onDynamic: schema },
	onSubmit: async ({ value }) => {
		await onEditRegistry({
			name: value.name.trim(),
			url: value.url.trim(),
			username: value.username.trim(),
			password: value.password.trim() || undefined,
			project: value.project.trim() || undefined,
		});
	},
}));
</script>

<form class="contents" novalidate onsubmit={formSubmitHandler(form)}>
	<ChipModalHeader onClose={onCancel} closeDisabled={loading}>
		Edit registry
	</ChipModalHeader>
	<ChipModalBody>
		{#each TEXT_FIELDS as [name, label, placeholder] (name)}
			<form.AppField {name}>
				{#snippet children(
					field
				)}
					<field.TextField {label} {placeholder} autocomplete="off" />
				{/snippet}
			</form.AppField>
		{/each}
		<form.AppField name="password">
			{#snippet children(
				field
			)}
				<field.TextField
					label="Password"
					secret
					placeholder="Leave blank to keep the current password"
				/>
			{/snippet}
		</form.AppField>
		<form.AppField name="project">
			{#snippet children(
				field
			)}
				<field.TextField
					label="Project"
					placeholder="my-project"
					autocomplete="off"
				/>
			{/snippet}
		</form.AppField>
	</ChipModalBody>
	<ChipModalFooter {onCancel} cancelDisabled={loading}>
		{#snippet primaryAction()}
			<ChipModalAction type="submit" variant="primary" disabled={loading}>
				{loading ? 'Saving...' : 'Save'}
			</ChipModalAction>
		{/snippet}
	</ChipModalFooter>
</form>
