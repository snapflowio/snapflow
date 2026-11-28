<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
interface AdminTableEmptyProps {
	message: string;
	resource: string;
	search?: string;
	filterCount?: number;
	onClear?: () => void;
}
</script>

<script lang="ts">
import Inbox from '@lucide/svelte/icons/inbox';
import Search from '@lucide/svelte/icons/search';
import EmptyState from '#lib/components/empty-state.svelte';
import { clearNarrowingLabel } from '#lib/components/resource/resource-list.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';

let {
	message,
	resource,
	search = '',
	filterCount = 0,
	onClear,
}: AdminTableEmptyProps = $props();

const trimmedSearch = $derived(search.trim());
const narrowed = $derived(trimmedSearch.length > 0 || filterCount > 0);
const text = $derived.by(() => {
	if (trimmedSearch) return `No results for “${trimmedSearch}”`;
	if (filterCount > 0) return `No ${resource} match these filters`;
	return message;
});
</script>

{#snippet clearAction()}
	<Chip variant="secondary" onclick={onClear}>
		{clearNarrowingLabel(trimmedSearch, filterCount)}
	</Chip>
{/snippet}

<EmptyState
	icon={narrowed ? Search : Inbox}
	bordered={false}
	title={text}
	actions={narrowed && onClear ? clearAction : undefined}
/>
