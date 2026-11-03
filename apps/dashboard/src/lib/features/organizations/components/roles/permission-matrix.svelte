<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import {
	ORGANIZATION_STATEMENT,
	type OrganizationResource,
} from '@snapflow/organization-access';

function resourceActions(resource: OrganizationResource): readonly string[] {
	return ORGANIZATION_STATEMENT[resource];
}

interface PermissionMatrixProps {
	isGrantable: (resource: string, action: string) => boolean;
	onChange: (permissions: string[]) => void;
	value: readonly string[];
}
</script>

<script lang="ts">
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import Checkbox from '#lib/components/ui/checkbox/checkbox.svelte';
import Label from '#lib/components/ui/label.svelte';
import {
	ORGANIZATION_RESOURCE_LABEL,
	ORGANIZATION_RESOURCES,
	permissionKey,
} from '#lib/features/organizations/lib/organization-resources.ts';

let { isGrantable, onChange, value }: PermissionMatrixProps = $props();

const matrixId = $props.id();

const selected = $derived(new Set(value));

function toggle(key: string, checked: boolean): void {
	onChange(
		checked ? [...value, key] : value.filter((current) => current !== key)
	);
}
</script>

<KeyValueList>
	{#each ORGANIZATION_RESOURCES as resource (resource)}
		{#snippet resourceLabel()}
			{ORGANIZATION_RESOURCE_LABEL[resource]}
		{/snippet}
		{#snippet resourceToggles()}
			<div class="flex flex-wrap justify-end gap-x-4 gap-y-2">
				{#each resourceActions(resource) as action (action)}
					{const key = $derived(permissionKey(resource, action))}
					{const id = $derived(`${matrixId}-${resource}-${action}`)}
					<span class="inline-flex items-center gap-1.5">
						<Checkbox
							{id}
							size="sm"
							checked={selected.has(key)}
							disabled={!isGrantable(resource, action)}
							onCheckedChange={(checked) => toggle(key, checked === true)}
						/>
						<Label for={id}>{action}</Label>
					</span>
				{/each}
			</div>
		{/snippet}
		<KeyValueRow label={resourceLabel} value={resourceToggles} />
	{/each}
</KeyValueList>
