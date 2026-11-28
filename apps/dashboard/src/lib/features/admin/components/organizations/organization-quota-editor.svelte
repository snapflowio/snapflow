<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { OrganizationQuota } from '@snapflow/api-client';
import { createMutation } from '@tanstack/svelte-query';
import {
	QUOTA_SANDBOX_CLASS,
	removeOrganizationQuotaMutationOptions,
	saveOrganizationQuotaMutationOptions,
} from '#lib/api/admin/organizations.ts';
import {
	type HeaderAction,
	saveDiscardActions,
} from '#lib/components/page/header-actions.ts';
import PageColumn from '#lib/components/page/page-column.svelte';
import ResourceDetailShell from '#lib/components/resource/resource-detail-shell.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import UnsavedChangesGuard from '#lib/components/settings/unsaved-changes-guard.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import type { OrganizationDetailChrome } from '#lib/features/admin/lib/organization-detail-tabs.ts';
import { createQuantityForm } from '#lib/features/admin/lib/quantity-form.svelte.ts';
import {
	QUOTA_LIMIT_FIELDS,
	QUOTA_TOTAL_FIELDS,
} from '#lib/features/admin/lib/quota-fields.ts';
import QuantityFields from './quantity-fields.svelte';

interface OrganizationQuotaEditorProps {
	chrome: OrganizationDetailChrome;
	organizationId: string;
	quota: OrganizationQuota | null;
}

let { chrome, organizationId, quota }: OrganizationQuotaEditorProps = $props();

const formId = $props.id();
const save = createMutation(() =>
	saveOrganizationQuotaMutationOptions(organizationId)
);
const remove = createMutation(() =>
	removeOrganizationQuotaMutationOptions(organizationId)
);
const quantityForm = createQuantityForm({
	requiredFields: QUOTA_TOTAL_FIELDS,
	optionalFields: QUOTA_LIMIT_FIELDS,
	initialValues: () => quota ?? {},
	onSubmit: (values) => save.mutateAsync({ exists: quota !== null, values }),
});
const status = quantityForm.form.useStore((state) => ({
	dirty: !state.isDefaultValue,
	submitting: state.isSubmitting,
}));
let removing = $state(false);

const actions: HeaderAction[] = $derived([
	{
		id: 'delete',
		kind: 'delete',
		label: 'Remove quota',
		onSelect: () => {
			removing = true;
		},
		visible: quota !== null,
	},
	...saveDiscardActions({
		dirty: status.current.dirty,
		saving: status.current.submitting,
		onDiscard: () => quantityForm.form.reset(),
		form: formId,
	}),
]);

function confirmRemove() {
	remove.mutate(undefined, {
		onSuccess: () => {
			removing = false;
		},
	});
}
</script>

<ResourceDetailShell {...chrome} actions={[...chrome.actions, ...actions]}>
	<PageColumn width="settings">
		<SettingsSection
			title="Marketplace quota"
			description={`Totals and per-sandbox limits for ${QUOTA_SANDBOX_CLASS} sandboxes on marketplace machines. Leave total CPU empty to follow lifetime deposits and a limit empty for no limit.`}
		>
			<QuantityFields id={formId} {quantityForm} />
		</SettingsSection>
	</PageColumn>
</ResourceDetailShell>
<UnsavedChangesGuard
	dirty={status.current.dirty}
	onDiscard={() => quantityForm.form.reset()}
/>
<ChipModalConfirm
	bind:open={removing}
	title="Remove quota"
	text={[
		'Are you sure you want to remove the quota for ',
		{ text: QUOTA_SANDBOX_CLASS, bold: true },
		' sandboxes? ',
		{
			text: 'The organization cannot create sandboxes on marketplace machines until a new quota is set.',
			error: true,
		},
	]}
	pending={remove.isPending}
	onsubmit={confirmRemove}
>
	{#snippet confirm()}
		<Chip
			loading={remove.isPending}
			type="submit"
			variant="destructive"
			disabled={remove.isPending}
		>
			Remove
		</Chip>
	{/snippet}
</ChipModalConfirm>
