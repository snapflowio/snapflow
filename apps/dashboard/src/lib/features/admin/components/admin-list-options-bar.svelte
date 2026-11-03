<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ResourceOptionsBar from '#lib/components/resource/resource-options-bar.svelte';
import AdminFilterPanel from '#lib/features/admin/components/admin-filter-panel.svelte';
import type { AdminListControls } from '#lib/features/admin/state/admin-list-controls.svelte.ts';

interface AdminListOptionsBarProps {
	controls: AdminListControls;
	placeholder: string;
	ariaLabel: string;
}

let { controls, placeholder, ariaLabel }: AdminListOptionsBarProps = $props();
</script>

{#snippet filterContent()}
	<AdminFilterPanel
		fields={controls.filterFields}
		onClear={controls.clearFilters}
	/>
{/snippet}

<ResourceOptionsBar
	search={{
		value: controls.search.value,
		onChange: (value) => {
			controls.search.value = value;
		},
		placeholder,
		ariaLabel,
	}}
	filterTags={controls.filterTags}
	onClearFilters={controls.clearFilters}
	filter={{ content: filterContent, active: controls.filterTags.length > 0 }}
	sort={controls.sortConfig}
/>
