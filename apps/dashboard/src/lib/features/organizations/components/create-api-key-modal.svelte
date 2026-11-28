<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { CreateApiKeyDto } from '@snapflow/api-client';
import { CREDENTIAL_ASSIGNABLE_STATEMENT } from '@snapflow/organization-access';
import * as z from 'zod';
import type { ChipRadioCard } from '#lib/components/ui/chip/chip-radio-cards.svelte';
import {
	API_KEY_NAME_MAX_LENGTH,
	type ApiKeyScopeOption,
} from '#lib/features/organizations/lib/api-key-permissions.ts';
import {
	permissionKey,
	permissionKeysToRecord,
	scopeResources,
} from '#lib/features/organizations/lib/organization-resources.ts';

const API_KEY_VARIABLE = 'SNAPFLOW_API_KEY';
const SECONDS_PER_DAY = 86_400;
const NEVER_EXPIRES = 'never';
const EXPIRATION_OPTIONS = [
	{ value: '30', label: '30 days' },
	{ value: '90', label: '90 days' },
	{ value: '365', label: '1 year' },
	{ value: NEVER_EXPIRES, label: 'Never' },
] as const;
const DEFAULT_EXPIRATION = EXPIRATION_OPTIONS[1].value;
const COPY_FIRST_REASON = 'Copy the key first';
const SCOPE_RESOURCES = scopeResources(CREDENTIAL_ASSIGNABLE_STATEMENT);

type ApiKeyAccess = 'full' | 'restricted';

const ACCESS_OPTIONS: readonly ChipRadioCard<ApiKeyAccess>[] = [
	{
		value: 'full',
		title: 'Full access',
		meta: 'Everything you can do in this organization',
	},
	{
		value: 'restricted',
		title: 'Restricted',
		meta: 'Only the permissions you pick',
	},
];

const createApiKeySchema = z
	.object({
		name: z
			.string()
			.trim()
			.min(1, 'Name is required')
			.max(
				API_KEY_NAME_MAX_LENGTH,
				`Name must be ${API_KEY_NAME_MAX_LENGTH} characters or fewer`
			),
		expiration: z.string(),
		access: z.enum(['full', 'restricted']),
		scopes: z.array(z.string()),
	})
	.refine((values) => values.access === 'full' || values.scopes.length > 0, {
		message: 'Select at least one permission',
		path: ['scopes'],
	});

type CreateApiKeyValues = z.infer<typeof createApiKeySchema>;

const DEFAULT_VALUES: CreateApiKeyValues = {
	name: '',
	expiration: DEFAULT_EXPIRATION,
	access: 'full',
	scopes: [],
};

function toCreateApiKeyBody(
	values: CreateApiKeyValues,
	allScopes: readonly string[]
): CreateApiKeyDto {
	return {
		name: values.name.trim(),
		expiresIn:
			values.expiration === NEVER_EXPIRES
				? undefined
				: Number(values.expiration) * SECONDS_PER_DAY,
		permissions: permissionKeysToRecord(
			values.access === 'full' ? allScopes : values.scopes
		),
	};
}

interface CreateApiKeyModalProps {
	scopeOptions: readonly ApiKeyScopeOption[];
	onCreate: (body: CreateApiKeyDto) => Promise<string | null>;
	open?: boolean;
}
</script>

<script lang="ts">
import { revalidateLogic } from '@tanstack/svelte-form';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import FieldError from '#lib/components/form/field-error.svelte';
import { firstFieldError } from '#lib/components/form/field-errors.ts';
import { formSubmitHandler } from '#lib/components/form/submit.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import {
	chipFieldSurfaceClass,
	chipFieldTextClass,
} from '#lib/components/ui/chip/chip-chrome.ts';
import ChipRadioCards from '#lib/components/ui/chip/chip-radio-cards.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import CopyCodeButton from '#lib/components/ui/clipboard/copy-code-button.svelte';
import SecretReveal from '#lib/components/ui/clipboard/secret-reveal.svelte';
import ApiKeyScopePicker from '#lib/features/organizations/components/api-keys/api-key-scope-picker.svelte';
import { cn } from '#lib/utils/utils.ts';

let {
	onCreate,
	open = $bindable(false),
	scopeOptions,
}: CreateApiKeyModalProps = $props();

let secret = $state<string | null>(null);
let copied = $state(false);

const allScopes = $derived(scopeOptions.map((option) => option.value));
const grantable = $derived(new Set(allScopes));
const usage = $derived(`export ${API_KEY_VARIABLE}=${secret ?? ''}`);

const form = createAppForm(() => ({
	defaultValues: DEFAULT_VALUES,
	validationLogic: revalidateLogic(),
	validators: { onDynamic: createApiKeySchema },
	onSubmit: async ({ value }) => {
		const created = await onCreate(toCreateApiKeyBody(value, allScopes));
		if (created === null) return;
		secret = created;
		form.reset();
	},
}));

const status = form.useSelector((state) => ({
	submitting: state.isSubmitting,
	dirty: !state.isDefaultValue,
	restricted: state.values.access === 'restricted',
}));

function reset(): void {
	form.reset();
	secret = null;
	copied = false;
}

function close(): void {
	open = false;
	reset();
}

function isGrantable(resource: string, action: string): boolean {
	return grantable.has(permissionKey(resource, action));
}
</script>

<ChipModal
	bind:open
	onOpenChange={(nextOpen) => {
		if (!nextOpen) reset();
	}}
	onsubmit={secret === null ? formSubmitHandler(form) : undefined}
	dismissDisabled={status.current.submitting || (secret !== null && !copied)}
	hasUnsavedInput={secret === null && status.current.dirty}
	variant="sheet"
	srTitle={secret === null ? 'Create API key' : 'API key created'}
>
	{#if secret === null}
		<ChipModalHeader onClose={close} closeDisabled={status.current.submitting}>
			Create API key
		</ChipModalHeader>
		<ChipModalBody>
			<form.AppField name="name">
				{#snippet children(field)}
					<field.TextField
						label="Name"
						placeholder="Production deploys"
						maxlength={API_KEY_NAME_MAX_LENGTH}
						autocomplete="off"
						required
					/>
				{/snippet}
			</form.AppField>
			<form.AppField name="expiration">
				{#snippet children(field)}
					<field.SelectField
						label="Expires after"
						options={EXPIRATION_OPTIONS}
					/>
				{/snippet}
			</form.AppField>
			<form.AppField name="access">
				{#snippet children(field)}
					<ChipModalField label="Access">
						<ChipRadioCards
							label="Access"
							options={ACCESS_OPTIONS}
							value={field.state.value}
							onValueChange={field.handleChange}
						/>
					</ChipModalField>
				{/snippet}
			</form.AppField>
			{#if status.current.restricted}
				<form.AppField name="scopes">
					{#snippet children(field)}
						<div class="flex flex-col gap-2">
							<ApiKeyScopePicker
								resources={SCOPE_RESOURCES}
								value={field.state.value}
								onChange={field.handleChange}
								{isGrantable}
							/>
							{#if firstFieldError(field.state.meta.errors)}
								<FieldError errors={field.state.meta.errors} />
							{/if}
						</div>
					{/snippet}
				</form.AppField>
			{/if}
		</ChipModalBody>
		<ChipModalFooter
			onCancel={close}
			cancelDisabled={status.current.submitting}
		>
			{#snippet primaryAction()}
				<Chip
					loading={status.current.submitting}
					type="submit"
					variant="primary"
				>
					Create API key
				</Chip>
			{/snippet}
		</ChipModalFooter>
	{:else}
		<ChipModalHeader onClose={copied ? close : undefined}>
			API key created
		</ChipModalHeader>
		<ChipModalBody>
			<SecretReveal value={secret} onCopied={() => (copied = true)} />
			<ChipModalField label="Use it from a shell">
				<div
					class={cn(
						'flex h-10 w-full items-center gap-2 overflow-hidden pr-1 pl-3',
						chipFieldSurfaceClass
					)}
				>
					<code class={cn(chipFieldTextClass, 'flex-1 truncate font-mono')}>
						export {API_KEY_VARIABLE}=…
					</code>
					<CopyCodeButton code={usage} label="Copy export command" />
				</div>
			</ChipModalField>
		</ChipModalBody>
		<ChipModalFooter hideCancel>
			{#snippet primaryAction()}
				<Chip
					variant="primary"
					disabledReason={copied ? undefined : COPY_FIRST_REASON}
					onclick={close}
				>
					Done
				</Chip>
			{/snippet}
		</ChipModalFooter>
	{/if}
</ChipModal>
