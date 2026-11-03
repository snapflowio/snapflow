<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import * as z from 'zod';
import {
	domainAllowListSchema,
	networkAllowListSchema,
} from '#lib/features/sandboxes/lib/sandbox-network-policy.ts';

const networkPolicySchema = z.object({
	blockAll: z.boolean(),
	cidrAllowList: networkAllowListSchema,
	domainAllowList: domainAllowListSchema,
});
</script>

<script lang="ts">
import { revalidateLogic } from '@tanstack/svelte-form';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import { organizationLimitsQueryOptions } from '#lib/api/organizations/limits.ts';
import { sandboxNetworkPolicyMutationOptions } from '#lib/api/sandboxes/sandboxes.ts';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import {
	formSubmitHandler,
	submitMutation,
} from '#lib/components/form/submit.ts';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import { canUpdateSandboxNetworkPolicy } from '#lib/features/sandboxes/lib/sandbox-state.ts';
import { getSandboxDetail } from '#lib/features/sandboxes/state/sandbox-detail.svelte.ts';

const formId = $props.id();
const detail = getSandboxDetail();
const updatePolicy = createMutation(() =>
	sandboxNetworkPolicyMutationOptions(detail.sandbox.id)
);
const limitsQuery = createQuery(() => organizationLimitsQueryOptions());
const organizationRestrictsNetworkPolicy = $derived(
	limitsQuery.data?.sandboxLimitedNetworkEgress === true
);
const networkPolicyEditable = $derived(
	detail.canWrite &&
		canUpdateSandboxNetworkPolicy(detail.sandbox) &&
		!organizationRestrictsNetworkPolicy
);

const policyForm = createAppForm(() => ({
	defaultValues: {
		blockAll: detail.sandbox.networkBlockAll,
		cidrAllowList: detail.sandbox.networkAllowList ?? '',
		domainAllowList: detail.sandbox.domainAllowList ?? '',
	},
	validationLogic: revalidateLogic(),
	validators: { onDynamic: networkPolicySchema },
	onSubmit: async ({ value }) => {
		const saved = await submitMutation(() =>
			updatePolicy.mutateAsync({
				networkBlockAll: value.blockAll,
				networkAllowList: value.cidrAllowList.trim(),
				domainAllowList: value.domainAllowList.trim(),
			})
		);
		if (saved) policyForm.reset(value);
	},
}));
const policyBlocksAllEgress = policyForm.useSelector(
	(state) => state.values.blockAll
);

function clearAllowListsWhenBlocked({ value }: { value: boolean }) {
	if (!value) return;
	policyForm.setFieldValue('cidrAllowList', '');
	policyForm.setFieldValue('domainAllowList', '');
}
</script>

{#snippet saveActions()}
	<policyForm.Subscribe
		selector={(state) => [state.isDirty, state.isSubmitting] as const}
	>
		{#snippet children([dirty, saving])}
			{#if dirty}
				<Chip disabled={saving} onclick={() => policyForm.reset()}
					>Discard</Chip
				>
			{/if}
			<Chip
				type="submit"
				form={formId}
				variant="primary"
				disabled={!dirty || saving || detail.pending || !networkPolicyEditable}
				aria-busy={saving || undefined}
			>
				{saving ? 'Saving...' : 'Save'}
			</Chip>
		{/snippet}
	</policyForm.Subscribe>
{/snippet}

<SettingsSection
	title="Outbound policy"
	action={networkPolicyEditable ? saveActions : undefined}
>
	<form
		id={formId}
		class="flex flex-col gap-4"
		novalidate
		onsubmit={formSubmitHandler(policyForm)}
	>
		{#if organizationRestrictsNetworkPolicy}
			<Notice>
				{#snippet title()}
					Egress is limited by your organization
				{/snippet}
				{#snippet description()}
					Sandbox-level overrides are disabled.
				{/snippet}
			</Notice>
		{/if}
		<policyForm.AppField
			name="blockAll"
			listeners={{
				onChange: clearAllowListsWhenBlocked,
				onMount: clearAllowListsWhenBlocked,
			}}
		>
			{#snippet children(
				field
			)}
				<field.SwitchField
					disabled={!networkPolicyEditable}
					label="Block all egress"
					description="Denies all non-platform destinations and clears the allow lists."
				/>
			{/snippet}
		</policyForm.AppField>
		<policyForm.AppField name="cidrAllowList">
			{#snippet children(
				field
			)}
				<field.TextField
					disabled={!networkPolicyEditable || policyBlocksAllEgress.current}
					label="CIDR allow list"
					placeholder="10.0.0.0/8, 192.168.0.0/16"
				/>
			{/snippet}
		</policyForm.AppField>
		<policyForm.AppField name="domainAllowList">
			{#snippet children(
				field
			)}
				<field.TextField
					disabled={!networkPolicyEditable || policyBlocksAllEgress.current}
					label="Domain allow list"
					placeholder="registry.npmjs.org, github.com"
				/>
			{/snippet}
		</policyForm.AppField>
	</form>
</SettingsSection>
