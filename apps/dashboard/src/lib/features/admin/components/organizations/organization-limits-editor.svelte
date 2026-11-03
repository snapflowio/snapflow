<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { OrganizationLimits } from '@snapflow/api-client';
import { createMutation } from '@tanstack/svelte-query';
import { updateOrganizationLimitsMutationOptions } from '#lib/api/admin/organizations.ts';
import { saveDiscardActions } from '#lib/components/page/header-actions.ts';
import PageColumn from '#lib/components/page/page-column.svelte';
import ResourceDetailShell from '#lib/components/resource/resource-detail-shell.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import UnsavedChangesGuard from '#lib/components/settings/unsaved-changes-guard.svelte';
import type { OrganizationDetailChrome } from '#lib/features/admin/lib/organization-detail-tabs.ts';
import { createQuantityForm } from '#lib/features/admin/lib/quantity-form.svelte.ts';
import { ORGANIZATION_LIMIT_FIELDS } from '#lib/features/admin/lib/quota-fields.ts';
import QuantityFields from './quantity-fields.svelte';

interface OrganizationLimitsEditorProps {
	chrome: OrganizationDetailChrome;
	organizationId: string;
	limits: OrganizationLimits;
}

let { chrome, organizationId, limits }: OrganizationLimitsEditorProps =
	$props();

const formId = $props.id();
const updateLimits = createMutation(() =>
	updateOrganizationLimitsMutationOptions(organizationId)
);
const quantityForm = createQuantityForm({
	requiredFields: ORGANIZATION_LIMIT_FIELDS,
	initialValues: () => limits,
	onSubmit: (values) => updateLimits.mutateAsync(values),
});
const status = quantityForm.form.useStore((state) => ({
	dirty: !state.isDefaultValue,
	submitting: state.isSubmitting,
}));
const actions = $derived(
	saveDiscardActions({
		dirty: status.current.dirty,
		saving: status.current.submitting,
		onSave: () => {},
		onDiscard: () => quantityForm.form.reset(),
		form: formId,
	})
);
</script>

<ResourceDetailShell {...chrome} {actions}>
	<PageColumn>
		<SettingsSection
			title="Sandbox limits"
			description="Applies to sandboxes and storage the organization creates after saving."
		>
			<QuantityFields id={formId} {quantityForm} />
		</SettingsSection>
	</PageColumn>
</ResourceDetailShell>
<UnsavedChangesGuard
	dirty={status.current.dirty}
	onDiscard={() => quantityForm.form.reset()}
/>
