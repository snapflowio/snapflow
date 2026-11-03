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
	REFRESH_INTERVALS,
	type ResourceRefreshInterval,
} from './resource-refresh.ts';

const REFRESH_OPTIONS = REFRESH_INTERVALS.map(({ label, value }) => ({
	label,
	value,
}));

interface ResourceRefreshControlProps {
	disabled?: boolean;
	isRefreshing: boolean;
	onIntervalChange: (interval: ResourceRefreshInterval) => void;
	onRefresh: () => void;
	value: ResourceRefreshInterval;
}
</script>

<script lang="ts">
import RefreshCw from '@lucide/svelte/icons/refresh-cw';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';

let {
	disabled = false,
	isRefreshing,
	onIntervalChange,
	onRefresh,
	value,
}: ResourceRefreshControlProps = $props();

const selectedValue = $derived(
	REFRESH_INTERVALS.find((option) => option.milliseconds === value)?.value ??
		'off'
);

function selectInterval(nextValue: string) {
	const interval = REFRESH_INTERVALS.find(
		(option) => option.value === nextValue
	);
	if (interval) onIntervalChange(interval.milliseconds);
}
</script>

<div class="flex max-w-full flex-wrap items-center gap-1">
	<Chip
		leftIcon={RefreshCw}
		disabled={disabled || isRefreshing}
		onclick={onRefresh}
	>
		{isRefreshing ? 'Refreshing...' : 'Refresh'}
	</Chip>
	<ChipDropdown
		aria-label="Automatic refresh interval"
		{disabled}
		matchTriggerWidth={false}
		options={REFRESH_OPTIONS}
		value={selectedValue}
		onChange={selectInterval}
	/>
</div>
