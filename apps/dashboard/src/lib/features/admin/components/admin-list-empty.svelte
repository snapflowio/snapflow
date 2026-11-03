<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import EmptyState from '#lib/components/empty-state.svelte';
import AdminNoResults from '#lib/features/admin/components/admin-no-results.svelte';

interface AdminListEmptyProps {
	search: string;
	filterCount: number;
	onClear: () => void;
	title: string;
	description: string;
}

let { search, filterCount, onClear, title, description }: AdminListEmptyProps =
	$props();
</script>

{#if search || filterCount > 0}
	<AdminNoResults {search} {filterCount} {onClear} />
{:else}
	<EmptyState {title} {description} />
{/if}
